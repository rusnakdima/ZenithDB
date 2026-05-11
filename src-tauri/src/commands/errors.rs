use thiserror::Error;

#[derive(Error, Debug)]
pub enum ZenithError {
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),
    #[error("Query failed: {0}")]
    QueryFailed(String),
    #[error("Invalid identifier: {0}")]
    InvalidIdentifier(String),
    #[error("Resource not found: {0}")]
    NotFound(String),
}