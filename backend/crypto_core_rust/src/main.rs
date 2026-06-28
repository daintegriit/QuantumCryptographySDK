// backend/crypto_core_rust/src/main.rs
//
// CLI interface to the Rust crypto core.
// All output is JSON to stdout so Python can parse it.
//
// Usage:
//   crypto_core_bin keygen kem Kyber768
//   crypto_core_bin keygen sig Dilithium3
//   crypto_core_bin encap Kyber768 <public_key_b64>
//   crypto_core_bin decap Kyber768 <private_key_b64> <ciphertext_b64>
//   crypto_core_bin sign Dilithium3 <private_key_b64> <message>
//   crypto_core_bin verify Dilithium3 <public_key_b64> <message> <signature_b64>
//   crypto_core_bin benchmark
//   crypto_core_bin health

use std::env;
use std::time::Instant;

// Pull in the crypto core from lib.rs
use crypto_core_rust::{
    kem_keygen, kem_encapsulate, kem_decapsulate,
    sig_keygen, sign_message, verify_signature,
    supported_schemes,
};

use serde_json::{json, Value};

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() < 2 {
        print_json(json!({
            "status": "ready",
            "message": "crypto_core_bin ready",
            "supported": supported_schemes(),
        }));
        return;
    }

    let result = dispatch(&args);

    match result {
        Ok(val) => print_json(val),
        Err(e) => {
            print_json(json!({
                "error": true,
                "code": e.code,
                "message": e.message,
            }));
            std::process::exit(1);
        }
    }
}

fn print_json(val: Value) {
    println!("{}", serde_json::to_string(&val).unwrap());
}

fn dispatch(args: &[String]) -> Result<Value, crypto_core_rust::CryptoCoreError> {
    match args[1].as_str() {

        // ── Health ────────────────────────────────────────────────
        "health" => Ok(json!({ "status": "ok" })),

        // ── KEM keygen ────────────────────────────────────────────
        // Usage: keygen kem <scheme>
        "keygen" => {
            if args.len() < 4 {
                return Ok(json!({ "error": "Usage: keygen <kem|sig> <scheme>" }));
            }
            let kind = args[2].as_str();
            let scheme = &args[3];

            match kind {
                "kem" => {
                    let kp = kem_keygen(scheme)?;
                    Ok(json!({
                        "type": "kem",
                        "scheme": kp.scheme,
                        "public_key": kp.public_key,
                        // private_key omitted from CLI output for safety
                        // use the Python API for operations that need it
                    }))
                }
                "sig" => {
                    let kp = sig_keygen(scheme)?;
                    Ok(json!({
                        "type": "signature",
                        "scheme": kp.scheme,
                        "public_key": kp.public_key,
                    }))
                }
                _ => Ok(json!({ "error": format!("Unknown kind: {}", kind) })),
            }
        }

        // ── KEM encapsulate ───────────────────────────────────────
        // Usage: encap <scheme> <public_key_b64>
        "encap" => {
            if args.len() < 4 {
                return Ok(json!({ "error": "Usage: encap <scheme> <public_key_b64>" }));
            }
            let scheme = &args[2];
            let pk_b64 = &args[3];
            let result = kem_encapsulate(scheme, pk_b64)?;
            Ok(json!({
                "scheme": result.scheme,
                "kem_ciphertext": result.ciphertext,
                "shared_secret": result.shared_secret,
            }))
        }

        // ── KEM decapsulate ───────────────────────────────────────
        // Usage: decap <scheme> <private_key_b64> <ciphertext_b64>
        "decap" => {
            if args.len() < 5 {
                return Ok(json!({ "error": "Usage: decap <scheme> <private_key_b64> <ciphertext_b64>" }));
            }
            let scheme = &args[2];
            let sk_b64 = &args[3];
            let ct_b64 = &args[4];
            let result = kem_decapsulate(scheme, sk_b64, ct_b64)?;
            Ok(json!({
                "scheme": result.scheme,
                "shared_secret": result.shared_secret,
            }))
        }

        // ── Sign ──────────────────────────────────────────────────
        // Usage: sign <scheme> <private_key_b64> <message>
        "sign" => {
            if args.len() < 5 {
                return Ok(json!({ "error": "Usage: sign <scheme> <private_key_b64> <message>" }));
            }
            let scheme = &args[2];
            let sk_b64 = &args[3];
            let message = args[4..].join(" ").into_bytes();
            let result = sign_message(scheme, sk_b64, &message)?;
            Ok(json!({
                "scheme": result.scheme,
                "signature": result.signature,
            }))
        }

        // ── Verify ────────────────────────────────────────────────
        // Usage: verify <scheme> <public_key_b64> <message> <signature_b64>
        "verify" => {
            if args.len() < 6 {
                return Ok(json!({ "error": "Usage: verify <scheme> <public_key_b64> <message> <signature_b64>" }));
            }
            let scheme = &args[2];
            let pk_b64 = &args[3];
            let message = args[4..args.len()-1].join(" ").into_bytes();
            let sig_b64 = &args[args.len()-1];
            let result = verify_signature(scheme, pk_b64, &message, sig_b64)?;
            Ok(json!({
                "scheme": result.scheme,
                "valid": result.valid,
            }))
        }

        // ── Benchmark ─────────────────────────────────────────────
        "benchmark" => {
            let iterations: u32 = if args.len() >= 3 {
                args[2].parse().unwrap_or(100)
            } else {
                100
            };

            Ok(run_benchmark(iterations))
        }

        _ => Ok(json!({ "error": format!("Unknown command: {}", args[1]) })),
    }
}

fn bench_scheme(
    scheme: &str,
    is_kem: bool,
    iterations: u32,
) -> Value {
    let mut times_ms: Vec<f64> = Vec::with_capacity(iterations as usize);

    for _ in 0..iterations {
        let start = Instant::now();

        if is_kem {
            if let Ok(kp) = kem_keygen(scheme) {
                let _ = kem_encapsulate(scheme, &kp.public_key)
                    .and_then(|enc| kem_decapsulate(scheme, &kp.private_key, &enc.ciphertext));
            }
        } else {
            if let Ok(kp) = sig_keygen(scheme) {
                let msg = b"benchmark_message";
                let _ = sign_message(scheme, &kp.private_key, msg)
                    .and_then(|sig| verify_signature(scheme, &kp.public_key, msg, &sig.signature));
            }
        }

        times_ms.push(start.elapsed().as_secs_f64() * 1000.0);
    }

    let avg_ms = times_ms.iter().sum::<f64>() / times_ms.len() as f64;
    let min_ms = times_ms.iter().cloned().fold(f64::INFINITY, f64::min);
    let max_ms = times_ms.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let ops_per_sec = 1000.0 / avg_ms;

    json!({
        "scheme": scheme,
        "type": if is_kem { "kem-full" } else { "sig-full" },
        "iterations": iterations,
        "avg_ms": (avg_ms * 10000.0).round() / 10000.0,
        "min_ms": (min_ms * 10000.0).round() / 10000.0,
        "max_ms": (max_ms * 10000.0).round() / 10000.0,
        "ops_per_sec": (ops_per_sec * 100.0).round() / 100.0,
    })
}

fn run_benchmark(iterations: u32) -> Value {
    let kem_schemes = vec![
        ("Kyber512", true),
        ("Kyber768", true),
        ("Kyber1024", true),
    ];

    let sig_schemes = vec![
        ("Dilithium2", false),
        ("Dilithium3", false),
        ("Dilithium5", false),
        ("Falcon-512", false),
        ("Falcon-1024", false),
    ];

    let mut results: Vec<Value> = Vec::new();

    for (scheme, is_kem) in kem_schemes.iter().chain(sig_schemes.iter()) {
        results.push(bench_scheme(scheme, *is_kem, iterations));
    }

    json!(results)
}