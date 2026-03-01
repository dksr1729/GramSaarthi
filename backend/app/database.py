import boto3

from .config import get_settings


def get_users_table():
    settings = get_settings()
    dynamodb = boto3.resource("dynamodb", region_name=settings.aws_region)
    return dynamodb.Table(settings.ddb_users_table)
