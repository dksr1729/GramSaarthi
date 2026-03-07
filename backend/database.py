import boto3
from botocore.exceptions import ClientError
from config import settings
from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger(__name__)


class DynamoDBClient:
    def __init__(self):
        self.dynamodb = None
        self.tables = {}
        self._initialize_client()

    def _initialize_client(self):
        """Initialize DynamoDB client"""
        try:
            resource_kwargs = {
                'region_name': settings.AWS_REGION,
            }

            # Prefer standard AWS credential resolution unless explicit values are provided.
            if settings.AWS_PROFILE:
                session = boto3.Session(profile_name=settings.AWS_PROFILE)
                resource_factory = session.resource
            else:
                resource_factory = boto3.resource

            if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
                resource_kwargs['aws_access_key_id'] = settings.AWS_ACCESS_KEY_ID
                resource_kwargs['aws_secret_access_key'] = settings.AWS_SECRET_ACCESS_KEY

            if settings.AWS_SESSION_TOKEN:
                resource_kwargs['aws_session_token'] = settings.AWS_SESSION_TOKEN

            if settings.DYNAMODB_ENDPOINT_URL:
                resource_kwargs['endpoint_url'] = settings.DYNAMODB_ENDPOINT_URL
                logger.info(f"Connecting to DynamoDB endpoint override: {settings.DYNAMODB_ENDPOINT_URL}")
            else:
                logger.info("Connecting to AWS DynamoDB")

            self.dynamodb = resource_factory('dynamodb', **resource_kwargs)
        except Exception as e:
            logger.error(f"Failed to initialize DynamoDB client: {e}")
            raise

    def get_table(self, table_name: str):
        """Get DynamoDB table"""
        if table_name not in self.tables:
            self.tables[table_name] = self.dynamodb.Table(table_name)
        return self.tables[table_name]

    def put_item(self, table_name: str, item: Dict[str, Any]) -> bool:
        """Put item in DynamoDB table"""
        try:
            table = self.get_table(table_name)
            table.put_item(Item=item)
            return True
        except ClientError as e:
            logger.error(f"Error putting item in {table_name}: {e}")
            return False

    def get_item(self, table_name: str, key: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Get item from DynamoDB table"""
        try:
            table = self.get_table(table_name)
            response = table.get_item(Key=key)
            return response.get('Item')
        except ClientError as e:
            logger.error(f"Error getting item from {table_name}: {e}")
            return None

    def query_items(self, table_name: str, key_condition_expression, **kwargs) -> List[Dict[str, Any]]:
        """Query items from DynamoDB table"""
        try:
            table = self.get_table(table_name)
            response = table.query(
                KeyConditionExpression=key_condition_expression,
                **kwargs
            )
            return response.get('Items', [])
        except ClientError as e:
            logger.error(f"Error querying items from {table_name}: {e}")
            return []

    def scan_items(self, table_name: str, **kwargs) -> List[Dict[str, Any]]:
        """Scan items from DynamoDB table"""
        try:
            table = self.get_table(table_name)
            response = table.scan(**kwargs)
            return response.get('Items', [])
        except ClientError as e:
            logger.error(f"Error scanning items from {table_name}: {e}")
            return []

    def update_item(self, table_name: str, key: Dict[str, Any], 
                   update_expression: str, expression_values: Dict[str, Any]) -> bool:
        """Update item in DynamoDB table"""
        try:
            table = self.get_table(table_name)
            table.update_item(
                Key=key,
                UpdateExpression=update_expression,
                ExpressionAttributeValues=expression_values
            )
            return True
        except ClientError as e:
            logger.error(f"Error updating item in {table_name}: {e}")
            return False

    def delete_item(self, table_name: str, key: Dict[str, Any]) -> bool:
        """Delete item from DynamoDB table"""
        try:
            table = self.get_table(table_name)
            table.delete_item(Key=key)
            return True
        except ClientError as e:
            logger.error(f"Error deleting item from {table_name}: {e}")
            return False


# Global DynamoDB client instance
db_client = DynamoDBClient()
