from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes


# Generate key and plaintext
key = get_random_bytes(16)
cipher = AES.new(key, AES.MODE_EAX)
plaintext = b'This is top secret'

# Encrypt
nonce = cipher.nonce
ciphertext, tag = cipher.encrypt_and_digest(plaintext)

print("Encrypted:", ciphertext.hex())

# Decrypt
cipher_dec = AES.new(key, AES.MODE_EAX, nonce=nonce)
decrypted = cipher_dec.decrypt(ciphertext)

print("Decrypted:", decrypted.decode())
