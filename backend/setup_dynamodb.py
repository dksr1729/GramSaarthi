"""Script to create required DynamoDB tables."""
import boto3
from botocore.exceptions import ClientError
from config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_dynamodb_tables():
    """Create all required DynamoDB tables"""

    client_kwargs = {
        'region_name': settings.AWS_REGION,
    }

    if settings.AWS_PROFILE:
        session = boto3.Session(profile_name=settings.AWS_PROFILE)
        client_factory = session.client
    else:
        client_factory = boto3.client

    if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        client_kwargs['aws_access_key_id'] = settings.AWS_ACCESS_KEY_ID
        client_kwargs['aws_secret_access_key'] = settings.AWS_SECRET_ACCESS_KEY

    if settings.AWS_SESSION_TOKEN:
        client_kwargs['aws_session_token'] = settings.AWS_SESSION_TOKEN

    if settings.DYNAMODB_ENDPOINT_URL:
        client_kwargs['endpoint_url'] = settings.DYNAMODB_ENDPOINT_URL
        logger.info(f"Using DynamoDB endpoint override: {settings.DYNAMODB_ENDPOINT_URL}")
    else:
        logger.info("Using AWS DynamoDB")

    dynamodb = client_factory('dynamodb', **client_kwargs)
    
    tables = [
        {
            'TableName': settings.DYNAMODB_USERS_TABLE,
            'KeySchema': [
                {'AttributeName': 'gmail', 'KeyType': 'HASH'}
            ],
            'AttributeDefinitions': [
                {'AttributeName': 'gmail', 'AttributeType': 'S'},
                {'AttributeName': 'persona', 'AttributeType': 'S'},
                {'AttributeName': 'district', 'AttributeType': 'S'}
            ],
            'GlobalSecondaryIndexes': [
                {
                    'IndexName': 'persona-index',
                    'KeySchema': [
                        {'AttributeName': 'persona', 'KeyType': 'HASH'}
                    ],
                    'Projection': {'ProjectionType': 'ALL'},
                    'ProvisionedThroughput': {
                        'ReadCapacityUnits': 5,
                        'WriteCapacityUnits': 5
                    }
                },
                {
                    'IndexName': 'district-index',
                    'KeySchema': [
                        {'AttributeName': 'district', 'KeyType': 'HASH'}
                    ],
                    'Projection': {'ProjectionType': 'ALL'},
                    'ProvisionedThroughput': {
                        'ReadCapacityUnits': 5,
                        'WriteCapacityUnits': 5
                    }
                }
            ],
            'ProvisionedThroughput': {
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        },
        {
            'TableName': settings.DYNAMODB_FORECASTS_TABLE,
            'KeySchema': [
                {'AttributeName': 'location_key', 'KeyType': 'HASH'},
                {'AttributeName': 'forecast_date', 'KeyType': 'RANGE'}
            ],
            'AttributeDefinitions': [
                {'AttributeName': 'location_key', 'AttributeType': 'S'},
                {'AttributeName': 'forecast_date', 'AttributeType': 'S'}
            ],
            'ProvisionedThroughput': {
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        },
        {
            'TableName': settings.DYNAMODB_SCHEMES_TABLE,
            'KeySchema': [
                {'AttributeName': 'scheme_id', 'KeyType': 'HASH'}
            ],
            'AttributeDefinitions': [
                {'AttributeName': 'scheme_id', 'AttributeType': 'S'}
            ],
            'ProvisionedThroughput': {
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        },
        {
            'TableName': settings.DYNAMODB_REPORTS_TABLE,
            'KeySchema': [
                {'AttributeName': 'location_key', 'KeyType': 'HASH'},
                {'AttributeName': 'report_id', 'KeyType': 'RANGE'}
            ],
            'AttributeDefinitions': [
                {'AttributeName': 'location_key', 'AttributeType': 'S'},
                {'AttributeName': 'report_id', 'AttributeType': 'S'}
            ],
            'ProvisionedThroughput': {
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        },
        {
            'TableName': settings.DYNAMODB_CHAT_SESSIONS_TABLE,
            'KeySchema': [
                {'AttributeName': 'session_id', 'KeyType': 'HASH'}
            ],
            'AttributeDefinitions': [
                {'AttributeName': 'session_id', 'AttributeType': 'S'}
            ],
            'ProvisionedThroughput': {
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        }
    ]
    
    for table_config in tables:
        try:
            dynamodb.create_table(**table_config)
            logger.info(f"Created table: {table_config['TableName']}")
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceInUseException':
                logger.info(f"Table already exists: {table_config['TableName']}")
            else:
                logger.error(f"Error creating table {table_config['TableName']}: {e}")
    
    logger.info("DynamoDB tables setup complete!")


if __name__ == "__main__":
    create_dynamodb_tables()
