fn main() {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        zenithdb::start_mcp_bridge();
        zenithdb::run();
    }
}
