"""
Script to seed initial data into the database
"""
import uuid
from datetime import datetime
from database import db_client
from vector_store import vector_store
from config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def seed_schemes():
    """Seed sample government schemes"""
    schemes = [
        {
            "scheme_id": str(uuid.uuid4()),
            "name": "Pradhan Mantri Awas Yojana - Gramin (PMAY-G)",
            "description": "Housing scheme for rural poor to construct pucca houses with basic amenities",
            "eligibility": "BPL families, SC/ST, minorities, women-headed households without pucca house",
            "application_process": "Apply through Gram Panchayat with required documents",
            "deadline": "2024-12-31",
            "source": "Ministry of Rural Development",
            "last_updated": datetime.utcnow().isoformat(),
            "category": "Housing"
        },
        {
            "scheme_id": str(uuid.uuid4()),
            "name": "Mahatma Gandhi National Rural Employment Guarantee Act (MGNREGA)",
            "description": "Provides 100 days of guaranteed wage employment to rural households",
            "eligibility": "Adult members of rural households willing to do unskilled manual work",
            "application_process": "Register at Gram Panchayat with job card application",
            "deadline": "Ongoing",
            "source": "Ministry of Rural Development",
            "last_updated": datetime.utcnow().isoformat(),
            "category": "Employment"
        },
        {
            "scheme_id": str(uuid.uuid4()),
            "name": "Pradhan Mantri Krishi Sinchai Yojana (PMKSY)",
            "description": "Irrigation scheme to expand cultivable area and improve water use efficiency",
            "eligibility": "Farmers with agricultural land, priority to SC/ST and small farmers",
            "application_process": "Apply through Agriculture Department with land documents",
            "deadline": "2024-06-30",
            "source": "Ministry of Agriculture",
            "last_updated": datetime.utcnow().isoformat(),
            "category": "Agriculture"
        },
        {
            "scheme_id": str(uuid.uuid4()),
            "name": "Swachh Bharat Mission - Gramin (SBM-G)",
            "description": "Sanitation program for construction of individual household toilets",
            "eligibility": "Rural households without toilet facility",
            "application_process": "Apply at Gram Panchayat with household details",
            "deadline": "Ongoing",
            "source": "Ministry of Jal Shakti",
            "last_updated": datetime.utcnow().isoformat(),
            "category": "Sanitation"
        },
        {
            "scheme_id": str(uuid.uuid4()),
            "name": "Jal Jeevan Mission (JJM)",
            "description": "Provides tap water connection to every rural household",
            "eligibility": "All rural households without piped water supply",
            "application_process": "Village Water and Sanitation Committee coordinates implementation",
            "deadline": "2024-12-31",
            "source": "Ministry of Jal Shakti",
            "last_updated": datetime.utcnow().isoformat(),
            "category": "Water Supply"
        },
        {
            "scheme_id": str(uuid.uuid4()),
            "name": "PM-KUSUM (Solar Pump Scheme)",
            "description": "Financial support for installation of solar pumps for irrigation",
            "eligibility": "Farmers with agricultural land and electricity connection",
            "application_process": "Apply through State Nodal Agency with land and electricity documents",
            "deadline": "2024-09-30",
            "source": "Ministry of New and Renewable Energy",
            "last_updated": datetime.utcnow().isoformat(),
            "category": "Energy"
        },
        {
            "scheme_id": str(uuid.uuid4()),
            "name": "National Rural Livelihood Mission (NRLM)",
            "description": "Promotes self-employment and skill development for rural poor",
            "eligibility": "Rural poor households, especially women",
            "application_process": "Join Self Help Groups through Gram Panchayat",
            "deadline": "Ongoing",
            "source": "Ministry of Rural Development",
            "last_updated": datetime.utcnow().isoformat(),
            "category": "Livelihood"
        },
        {
            "scheme_id": str(uuid.uuid4()),
            "name": "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
            "description": "Crop insurance scheme for farmers against crop loss",
            "eligibility": "All farmers growing notified crops",
            "application_process": "Apply through banks or Common Service Centers",
            "deadline": "Before sowing season",
            "source": "Ministry of Agriculture",
            "last_updated": datetime.utcnow().isoformat(),
            "category": "Agriculture"
        },
        {
            "scheme_id": str(uuid.uuid4()),
            "name": "Deen Dayal Upadhyaya Grameen Kaushalya Yojana (DDU-GKY)",
            "description": "Skill training and placement program for rural youth",
            "eligibility": "Rural youth aged 15-35 years from poor families",
            "application_process": "Register through Project Implementing Agencies",
            "deadline": "Ongoing",
            "source": "Ministry of Rural Development",
            "last_updated": datetime.utcnow().isoformat(),
            "category": "Skill Development"
        },
        {
            "scheme_id": str(uuid.uuid4()),
            "name": "Pradhan Mantri Gram Sadak Yojana (PMGSY)",
            "description": "Rural road connectivity program for unconnected habitations",
            "eligibility": "Habitations with population 500+ (250+ in hilly areas)",
            "application_process": "Gram Panchayat submits proposal to District Panchayat",
            "deadline": "Ongoing",
            "source": "Ministry of Rural Development",
            "last_updated": datetime.utcnow().isoformat(),
            "category": "Infrastructure"
        }
    ]
    
    # Add schemes to DynamoDB
    for scheme in schemes:
        success = db_client.put_item(settings.DYNAMODB_SCHEMES_TABLE, scheme)
        if success:
            logger.info(f"Added scheme: {scheme['name']}")
    
    # Add schemes to vector store
    documents = []
    for scheme in schemes:
        documents.append({
            'id': scheme['scheme_id'],
            'text': f"{scheme['name']} {scheme['description']} {scheme['eligibility']} {scheme['category']}",
            'metadata': {
                'scheme_id': scheme['scheme_id'],
                'category': scheme['category'],
                'source': scheme['source']
            }
        })
    
    vector_store.add_documents(documents)
    logger.info(f"Added {len(documents)} schemes to vector store")


def main():
    """Main seeding function"""
    logger.info("Starting data seeding...")
    
    try:
        seed_schemes()
        logger.info("Data seeding completed successfully!")
    except Exception as e:
        logger.error(f"Error during data seeding: {e}")


if __name__ == "__main__":
    main()
