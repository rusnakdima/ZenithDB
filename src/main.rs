// zenithdb: Forge app thin shell
use forge::prelude::*;
fn main() -> Result<(), String> {
  ForgeApp::new()
    .schema(include_str!("../schema.json"))
    .run()
}
