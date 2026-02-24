use rand::Rng;

#[no_mangle]
pub extern "C" fn generate_key() -> i32 {
    let key: i32 = rand::thread_rng().gen_range(10000..99999);
    key
}
