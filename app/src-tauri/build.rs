fn main() {
    // Rebuild native icon resources even when only the generated icons change.
    println!("cargo:rerun-if-changed=icons");
    tauri_build::build()
}
