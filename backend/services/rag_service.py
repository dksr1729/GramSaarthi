from typing import List, Dict, Any, Optional
from vector_store import vector_store
from database import db_client
from config import settings
import logging

logger = logging.getLogger(__name__)


class RAGService:
    def __init__(self):
        self.schemes_table = settings.DYNAMODB_SCHEMES_TABLE

    async def search_schemes(self, query: str, top_k: int = 5, 
                           filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Search for relevant schemes using RAG"""
        try:
            # Search vector store
            vector_results = vector_store.search(query, top_k=top_k, filters=filters)
            
            if not vector_results:
                logger.info(f"No schemes found for query: {query}")
                return []

            # Retrieve full scheme details from DynamoDB
            schemes = []
            for result in vector_results:
                scheme_id = result['metadata'].get('scheme_id')
                if scheme_id:
                    scheme = db_client.get_item(
                        self.schemes_table,
                        {"scheme_id": scheme_id}
                    )
                    
                    if scheme:
                        scheme['relevance_score'] = result['score']
                        schemes.append(scheme)

            logger.info(f"Found {len(schemes)} schemes for query: {query}")
            return schemes

        except Exception as e:
            logger.error(f"Error searching schemes: {e}")
            return []

    async def get_scheme_by_id(self, scheme_id: str) -> Optional[Dict[str, Any]]:
        """Get scheme details by ID"""
        try:
            scheme = db_client.get_item(
                self.schemes_table,
                {"scheme_id": scheme_id}
            )
            return scheme
        except Exception as e:
            logger.error(f"Error getting scheme by ID: {e}")
            return None

    async def get_all_schemes(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Get all schemes with optional filters"""
        try:
            if filters:
                # Apply filters using scan with filter expression
                schemes = db_client.scan_items(self.schemes_table)
                # Manual filtering (in production, use DynamoDB filter expressions)
                filtered_schemes = []
                for scheme in schemes:
                    match = True
                    for key, value in filters.items():
                        if scheme.get(key) != value:
                            match = False
                            break
                    if match:
                        filtered_schemes.append(scheme)
                return filtered_schemes
            else:
                schemes = db_client.scan_items(self.schemes_table)
                return schemes
        except Exception as e:
            logger.error(f"Error getting all schemes: {e}")
            return []

    async def add_scheme(self, scheme_data: Dict[str, Any]) -> bool:
        """Add a new scheme to the database and vector store"""
        try:
            # Save to DynamoDB
            success = db_client.put_item(self.schemes_table, scheme_data)
            
            if not success:
                return False

            # Add to vector store
            document = {
                'id': scheme_data['scheme_id'],
                'text': f"{scheme_data['name']} {scheme_data['description']} {scheme_data['eligibility']}",
                'metadata': {
                    'scheme_id': scheme_data['scheme_id'],
                    'category': scheme_data.get('category', ''),
                    'source': scheme_data.get('source', '')
                }
            }
            
            vector_store.add_documents([document])
            
            logger.info(f"Added scheme: {scheme_data['scheme_id']}")
            return True

        except Exception as e:
            logger.error(f"Error adding scheme: {e}")
            return False

    async def update_scheme(self, scheme_id: str, updates: Dict[str, Any]) -> bool:
        """Update an existing scheme"""
        try:
            # Build update expression
            update_expr = "SET " + ", ".join([f"{k} = :{k}" for k in updates.keys()])
            expr_values = {f":{k}": v for k, v in updates.items()}
            
            success = db_client.update_item(
                self.schemes_table,
                {"scheme_id": scheme_id},
                update_expr,
                expr_values
            )
            
            if success:
                logger.info(f"Updated scheme: {scheme_id}")
            
            return success

        except Exception as e:
            logger.error(f"Error updating scheme: {e}")
            return False

    async def delete_scheme(self, scheme_id: str) -> bool:
        """Delete a scheme"""
        try:
            # Delete from DynamoDB
            success = db_client.delete_item(
                self.schemes_table,
                {"scheme_id": scheme_id}
            )
            
            if success:
                # Delete from vector store
                vector_store.delete_document(scheme_id)
                logger.info(f"Deleted scheme: {scheme_id}")
            
            return success

        except Exception as e:
            logger.error(f"Error deleting scheme: {e}")
            return False


# Global RAG service instance
rag_service = RAGService()
