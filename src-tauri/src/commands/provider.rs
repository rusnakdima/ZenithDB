pub async fn create_json_provider(
    path: &str,
) -> Result<nosql_orm::providers::JsonProvider, String> {
    nosql_orm::providers::JsonProvider::new(path)
        .await
        .map_err(|e| e.to_string())
}

pub async fn create_mongo_provider(
    uri: &str,
    database: &str,
) -> Result<nosql_orm::providers::MongoProvider, String> {
    nosql_orm::providers::MongoProvider::connect(uri, database)
        .await
        .map_err(|e| e.to_string())
}

pub async fn create_redis_provider(
    uri: &str,
) -> Result<nosql_orm::providers::RedisProvider, String> {
    nosql_orm::providers::RedisProvider::new(uri)
        .await
        .map_err(|e| e.to_string())
}

pub async fn create_postgres_provider(
    uri: &str,
) -> Result<nosql_orm::providers::sql::PostgresProvider, String> {
    nosql_orm::providers::sql::PostgresProvider::connect(uri)
        .await
        .map_err(|e| e.to_string())
}

pub async fn create_sqlite_provider(
    path: &str,
) -> Result<nosql_orm::providers::sql::SqliteProvider, String> {
    nosql_orm::providers::sql::SqliteProvider::connect(path)
        .await
        .map_err(|e| e.to_string())
}

pub async fn create_mysql_provider(
    uri: &str,
) -> Result<nosql_orm::providers::sql::MySqlProvider, String> {
    nosql_orm::providers::sql::MySqlProvider::connect(uri)
        .await
        .map_err(|e| e.to_string())
}
