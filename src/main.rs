// forge-thin-shell: the app is JSON; the library boots it.
fn main() {
  forge::start("com.tcs.zenithdb").expect("forge app failed");
}
