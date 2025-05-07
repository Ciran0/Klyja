use std::env; // Needed for OUT_DIR
use std::io::Result;
use std::path::PathBuf; // Needed for path joining

fn main() -> Result<()> {
    println!("cargo:rerun-if-changed=../protobuf/AnimationData.proto");
    println!("cargo:rerun-if-changed=build.rs");

    // Get the Cargo OUT_DIR environment variable
    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR not set"));

    prost_build::Config::new()
        // Specify the output directory for generated code
        .out_dir(&out_dir) // Use OUT_DIR
        // Compile the .proto file
        .compile_protos(&["../protobuf/AnimationData.proto"], // Path relative to build.rs
                        &["../protobuf/"]) // Include path
        ?;
    Ok(())
}
