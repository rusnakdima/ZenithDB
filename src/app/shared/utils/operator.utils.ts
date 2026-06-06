export const MONGO_OPERATOR_MAP: Record<string, string> = {
  $eq: "eq",
  $ne: "neq",
  $gt: "gt",
  $gte: "gte",
  $lt: "lt",
  $lte: "lte",
  $in: "in",
  $nin: "notIn",
  $exists: "isNull",
  $regex: "like",
};
