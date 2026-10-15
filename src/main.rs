// zenithdb: Forge app thin shell
use forge::prelude::*;

fn main() {
    ZenithDBApp.run().expect("forge app failed");
}

struct ZenithDBApp;
impl ForgeApp for ZenithDBApp {
    fn app_id(&self) -> &str { "com.tcs.zenithdb" }
    fn app_name(&self) -> &str { "ZenithDB" }
    fn schema_path(&self) -> &std::path::Path { std::path::Path::new("schema.json") }
}
