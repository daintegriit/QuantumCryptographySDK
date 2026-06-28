use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use serde::{Deserialize, Serialize};
use std::fmt;

use oqs::kem::{Kem, Algorithm as KemAlgorithm};
use oqs::sig::{Sig, Algorithm as SigAlgorithm};

// ============================================================
// ERROR MODEL
// ============================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CryptoCoreError {
    pub code: String,
    pub message: String,
}

impl CryptoCoreError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self { code: code.into(), message: message.into() }
    }
}

impl fmt::Display for CryptoCoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

pub type CoreResult<T> = Result<T, CryptoCoreError>;

// ============================================================
// DATA STRUCTURES
// ============================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KemKeypair {
    pub scheme: String,
    pub public_key: String,
    pub private_key: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SignatureKeypair {
    pub scheme: String,
    pub public_key: String,
    pub private_key: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KemEncapsulationResult {
    pub scheme: String,
    pub ciphertext: String,
    pub shared_secret: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KemDecapsulationResult {
    pub scheme: String,
    pub shared_secret: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SignatureResult {
    pub scheme: String,
    pub signature: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VerifyResult {
    pub scheme: String,
    pub valid: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SupportedSchemes {
    pub kem: Vec<String>,
    pub signature: Vec<String>,
}

// ============================================================
// SCHEME RESOLUTION
// ML-KEM variants not available in oqs v0.9 — Kyber only
// ============================================================

fn resolve_kem_algorithm(scheme: &str) -> CoreResult<KemAlgorithm> {
    match scheme {
        "Kyber512"  => Ok(KemAlgorithm::Kyber512),
        "Kyber768"  => Ok(KemAlgorithm::Kyber768),
        "Kyber1024" => Ok(KemAlgorithm::Kyber1024),
        _ => Err(CryptoCoreError::new(
            "UNSUPPORTED_KEM_SCHEME",
            format!("Unsupported KEM scheme: {} (oqs v0.9 supports Kyber512/768/1024)", scheme),
        )),
    }
}

fn resolve_sig_algorithm(scheme: &str) -> CoreResult<SigAlgorithm> {
    match scheme {
        "Dilithium2"  => Ok(SigAlgorithm::Dilithium2),
        "Dilithium3"  => Ok(SigAlgorithm::Dilithium3),
        "Dilithium5"  => Ok(SigAlgorithm::Dilithium5),
        "Falcon-512"  => Ok(SigAlgorithm::Falcon512),
        "Falcon-1024" => Ok(SigAlgorithm::Falcon1024),
        _ => Err(CryptoCoreError::new(
            "UNSUPPORTED_SIGNATURE_SCHEME",
            format!("Unsupported signature scheme: {}", scheme),
        )),
    }
}

// ============================================================
// SUPPORTED SCHEMES
// ============================================================

pub fn supported_schemes() -> SupportedSchemes {
    SupportedSchemes {
        kem: vec![
            "Kyber512".to_string(),
            "Kyber768".to_string(),
            "Kyber1024".to_string(),
        ],
        signature: vec![
            "Dilithium2".to_string(),
            "Dilithium3".to_string(),
            "Dilithium5".to_string(),
            "Falcon-512".to_string(),
            "Falcon-1024".to_string(),
        ],
    }
}

// ============================================================
// HELPERS
// ============================================================

fn b64_encode(bytes: &[u8]) -> String {
    URL_SAFE_NO_PAD.encode(bytes)
}

fn b64_decode(input: &str, label: &str) -> CoreResult<Vec<u8>> {
    URL_SAFE_NO_PAD.decode(input).map_err(|e| {
        CryptoCoreError::new("BASE64_DECODE_FAILED", format!("Failed to decode {}: {}", label, e))
    })
}

// ============================================================
// KEM
// ============================================================

pub fn kem_keygen(scheme: &str) -> CoreResult<KemKeypair> {
    let alg = resolve_kem_algorithm(scheme)?;
    let kem = Kem::new(alg).map_err(|e| {
        CryptoCoreError::new("KEM_INIT_FAILED", format!("Init '{}': {}", scheme, e))
    })?;
    let (pk, sk) = kem.keypair().map_err(|e| {
        CryptoCoreError::new("KEM_KEYGEN_FAILED", format!("Keygen '{}': {}", scheme, e))
    })?;
    Ok(KemKeypair {
        scheme: scheme.to_string(),
        public_key: b64_encode(pk.as_ref()),
        private_key: b64_encode(sk.as_ref()),
    })
}

pub fn kem_encapsulate(scheme: &str, public_key_b64: &str) -> CoreResult<KemEncapsulationResult> {
    let alg = resolve_kem_algorithm(scheme)?;
    let pk_bytes = b64_decode(public_key_b64, "public key")?;
    let kem = Kem::new(alg).map_err(|e| {
        CryptoCoreError::new("KEM_INIT_FAILED", format!("Init '{}': {}", scheme, e))
    })?;
    let pk = kem.public_key_from_bytes(&pk_bytes).ok_or_else(|| {
        CryptoCoreError::new("KEM_INVALID_PK", "Invalid public key bytes")
    })?;
    let (ct, ss) = kem.encapsulate(&pk).map_err(|e| {
        CryptoCoreError::new("KEM_ENCAPSULATE_FAILED", format!("Encap failed: {}", e))
    })?;
    Ok(KemEncapsulationResult {
        scheme: scheme.to_string(),
        ciphertext: b64_encode(ct.as_ref()),
        shared_secret: b64_encode(ss.as_ref()),
    })
}

pub fn kem_decapsulate(
    scheme: &str,
    private_key_b64: &str,
    ciphertext_b64: &str,
) -> CoreResult<KemDecapsulationResult> {
    let alg = resolve_kem_algorithm(scheme)?;
    let sk_bytes = b64_decode(private_key_b64, "private key")?;
    let ct_bytes = b64_decode(ciphertext_b64, "ciphertext")?;
    let kem = Kem::new(alg).map_err(|e| {
        CryptoCoreError::new("KEM_INIT_FAILED", format!("Init '{}': {}", scheme, e))
    })?;
    let sk = kem.secret_key_from_bytes(&sk_bytes).ok_or_else(|| {
        CryptoCoreError::new("KEM_INVALID_SK", "Invalid secret key bytes")
    })?;
    let ct = kem.ciphertext_from_bytes(&ct_bytes).ok_or_else(|| {
        CryptoCoreError::new("KEM_INVALID_CT", "Invalid ciphertext bytes")
    })?;
    let ss = kem.decapsulate(&sk, &ct).map_err(|e| {
        CryptoCoreError::new("KEM_DECAPSULATE_FAILED", format!("Decap failed: {}", e))
    })?;
    Ok(KemDecapsulationResult {
        scheme: scheme.to_string(),
        shared_secret: b64_encode(ss.as_ref()),
    })
}

// ============================================================
// SIGNATURES
// ============================================================

pub fn sig_keygen(scheme: &str) -> CoreResult<SignatureKeypair> {
    let alg = resolve_sig_algorithm(scheme)?;
    let sig = Sig::new(alg).map_err(|e| {
        CryptoCoreError::new("SIG_INIT_FAILED", format!("Init '{}': {}", scheme, e))
    })?;
    let (pk, sk) = sig.keypair().map_err(|e| {
        CryptoCoreError::new("SIG_KEYGEN_FAILED", format!("Keygen '{}': {}", scheme, e))
    })?;
    Ok(SignatureKeypair {
        scheme: scheme.to_string(),
        public_key: b64_encode(pk.as_ref()),
        private_key: b64_encode(sk.as_ref()),
    })
}

pub fn sign_message(
    scheme: &str,
    private_key_b64: &str,
    message: &[u8],
) -> CoreResult<SignatureResult> {
    if message.is_empty() {
        return Err(CryptoCoreError::new("EMPTY_MESSAGE", "message must not be empty"));
    }
    let alg = resolve_sig_algorithm(scheme)?;
    let sk_bytes = b64_decode(private_key_b64, "private key")?;
    let sig = Sig::new(alg).map_err(|e| {
        CryptoCoreError::new("SIG_INIT_FAILED", format!("Init '{}': {}", scheme, e))
    })?;
    let sk = sig.secret_key_from_bytes(&sk_bytes).ok_or_else(|| {
        CryptoCoreError::new("SIG_INVALID_SK", "Invalid secret key bytes")
    })?;
    let signature = sig.sign(message, &sk).map_err(|e| {
        CryptoCoreError::new("SIGN_FAILED", format!("Sign '{}': {}", scheme, e))
    })?;
    Ok(SignatureResult {
        scheme: scheme.to_string(),
        signature: b64_encode(signature.as_ref()),
    })
}

pub fn verify_signature(
    scheme: &str,
    public_key_b64: &str,
    message: &[u8],
    signature_b64: &str,
) -> CoreResult<VerifyResult> {
    if message.is_empty() {
        return Err(CryptoCoreError::new("EMPTY_MESSAGE", "message must not be empty"));
    }
    let alg = resolve_sig_algorithm(scheme)?;
    let pk_bytes = b64_decode(public_key_b64, "public key")?;
    let sig_bytes = b64_decode(signature_b64, "signature")?;
    let sig = Sig::new(alg).map_err(|e| {
        CryptoCoreError::new("SIG_INIT_FAILED", format!("Init '{}': {}", scheme, e))
    })?;
    let pk = sig.public_key_from_bytes(&pk_bytes).ok_or_else(|| {
        CryptoCoreError::new("SIG_INVALID_PK", "Invalid public key bytes")
    })?;
    let signature = sig.signature_from_bytes(&sig_bytes).ok_or_else(|| {
        CryptoCoreError::new("SIG_INVALID_SIG", "Invalid signature bytes")
    })?;
    let valid = sig.verify(message, &signature, &pk).is_ok();
    Ok(VerifyResult { scheme: scheme.to_string(), valid })
}