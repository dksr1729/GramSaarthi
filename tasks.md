# Implementation Plan: GramSaarthi

## Overview

This implementation plan breaks down the GramSaarthi system into discrete coding tasks following a bottom-up approach: data layer first, then core intelligence components, API orchestration, and finally user interfaces. Each task builds incrementally, with testing integrated throughout to validate functionality early.

The implementation uses Python 3.11 for Lambda functions, AWS CDK for infrastructure, and Hypothesis for property-based testing.

## Tasks

- [ ] 1. Set up project structure and infrastructure foundation
  - Create directory structure: `/lambdas`, `/tests`, `/infrastructure`, `/data`
  - Set up AWS CDK project with Python
  - Configure CDK stacks: DataStack, ComputeStack, APIStack
  - Create requirements.txt with dependencies: boto3, aws-cdk-lib, hypothesis, pytest
  - Set up pytest configuration and test directory structure
  - _Requirements: All (foundation for entire system)_

- [ ] 2. Implement data layer and DynamoDB tables
  - [ ] 2.1 Define DynamoDB table schemas in CDK
    - Create Users table with partition key `userId` and GSI on `jurisdiction`
    - Create Forecasts table with partition key `jurisdiction` and sort key `forecastDate`
    - Create Schemes table with partition key `schemeId`
    - Create Reports table with partition key `jurisdiction` and sort key `reportId`
    - Create Sessions table with partition key `sessionId` and TTL attribute
    - Configure on-demand capacity mode for all tables
    - _Requirements: 1.1, 1.2, 2.1, 3.1, 5.4, 1.4_
  
  - [ ]* 2.2 Write property test for jurisdiction-based data isolation
    - **Property 2: Jurisdiction-Based Access Control**
    - **Validates: Requirements 1.2, 11.3**
  
  - [ ] 2.3 Create S3 buckets in CDK
    - Create data bucket with structure for historical data and models
    - Create reports bucket with lifecycle policy (90-day deletion)
    - Configure encryption at rest for both buckets
    - _Requirements: 2.2, 5.4, 5.5_

- [ ] 3. Implement authentication and authorization
  - [ ] 3.1 Create Auth Lambda function
    - Implement credential validation against DynamoDB Users table
    - Implement JWT token generation with jurisdiction claims using PyJWT
    - Implement token verification function
    - Implement session management with Sessions table
    - Add password hashing with bcrypt
    - _Requirements: 1.1, 1.2, 1.4_
  
  - [ ]* 3.2 Write property test for valid authentication
    - **Property 1: Valid Authentication Grants Access**
    - **Validates: Requirements 1.1**
  
  - [ ]* 3.3 Write property test for invalid authentication denial
    - **Property 3: Invalid Authentication Denial and Logging**
    - **Validates: Requirements 1.3**
  
  - [ ]* 3.4 Write property test for session token validation
    - **Property 4: Session Token Validation**
    - **Validates: Requirements 1.4**
  
  - [ ]* 3.5 Write unit tests for authentication edge cases
    - Test expired tokens
    - Test malformed tokens
    - Test missing credentials
    - _Requirements: 1.3, 1.4_

- [ ] 4. Checkpoint - Ensure authentication tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement water stress forecasting engine
  - [ ] 5.1 Create Forecast Lambda function
    - Implement data loading from S3 (historical rainfall and groundwater CSV)
    - Implement time series forecasting using Prophet library
    - Generate 30-day predictions with confidence intervals
    - Implement high-risk period detection based on threshold
    - Implement DynamoDB caching with 24-hour TTL
    - Add error handling for missing data
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [ ]* 5.2 Write property test for forecast length consistency
    - **Property 5: Forecast Length Consistency**
    - **Validates: Requirements 2.1**
  
  - [ ]* 5.3 Write property test for high-risk period flagging
    - **Property 6: High-Risk Period Flagging**
    - **Validates: Requirements 2.3**
  
  - [ ]* 5.4 Write property test for confidence intervals presence
    - **Property 7: Confidence Intervals Presence**
    - **Validates: Requirements 2.4**
  
  - [ ]* 5.5 Write unit tests for forecast edge cases
    - Test with missing historical data
    - Test with incomplete data
    - Test with extreme values
    - _Requirements: 2.5_
  
  - [ ] 5.6 Create synthetic historical data generator
    - Generate rainfall time series with seasonal patterns
    - Generate groundwater data correlated with rainfall
    - Save CSV files to S3 data bucket for testing
    - _Requirements: 2.2_

- [ ] 6. Implement RAG engine for scheme intelligence
  - [ ] 6.1 Create vector store setup script
    - Generate embeddings for scheme documents using Bedrock Titan
    - Store embeddings in FAISS index or OpenSearch Serverless
    - Create 100 synthetic scheme documents for testing
    - Upload scheme metadata to DynamoDB Schemes table
    - _Requirements: 3.1, 3.4_
  
  - [ ] 6.2 Create RAG Lambda function
    - Implement query embedding generation using Bedrock Titan
    - Implement vector similarity search (top-5 results)
    - Retrieve full scheme details from DynamoDB
    - Format results with metadata (source, date, eligibility, application process, deadlines)
    - Implement relevance ranking
    - _Requirements: 3.1, 3.2, 3.3, 3.5_
  
  - [ ]* 6.3 Write property test for scheme metadata completeness
    - **Property 8: Scheme Metadata Completeness**
    - **Validates: Requirements 3.2, 3.5**
  
  - [ ]* 6.4 Write unit tests for RAG edge cases
    - Test with no matching schemes
    - Test with empty query
    - Test with very long query
    - _Requirements: 3.1_

- [ ] 7. Implement sustainability recommendations engine
  - [ ] 7.1 Create Sustainability Lambda function
    - Implement Bedrock API integration for recommendation generation
    - Create prompt template emphasizing advisory nature and actionable steps
    - Implement scheme linking via RAG Lambda invocation
    - Add confidence scoring
    - Add advisory disclaimers to all outputs
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [ ]* 7.2 Write property test for recommendation actionability
    - **Property 9: Recommendation Actionability**
    - **Validates: Requirements 4.3**
  
  - [ ]* 7.3 Write property test for scheme linking
    - **Property 10: Scheme Linking in Recommendations**
    - **Validates: Requirements 4.4**
  
  - [ ]* 7.4 Write property test for advisory disclaimer presence
    - **Property 11: Advisory Disclaimer Presence**
    - **Validates: Requirements 4.5, 13.1, 13.2**

- [ ] 8. Checkpoint - Ensure intelligence layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement report generation
  - [ ] 9.1 Create Report Lambda function
    - Implement data compilation from Forecasts, Schemes, and Recommendations
    - Create HTML report template with sections for each data type
    - Implement PDF generation using WeasyPrint
    - Implement text format export
    - Store reports in S3 with jurisdiction-based key structure
    - Generate presigned URLs with 7-day expiration
    - Store report metadata in DynamoDB Reports table
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [ ]* 9.2 Write property test for report data source inclusion
    - **Property 12: Report Data Source Inclusion**
    - **Validates: Requirements 5.1**
  
  - [ ]* 9.3 Write property test for report metadata completeness
    - **Property 13: Report Metadata Completeness**
    - **Validates: Requirements 5.3, 13.3**
  
  - [ ]* 9.4 Write property test for report storage location
    - **Property 14: Report Storage Location**
    - **Validates: Requirements 5.4**
  
  - [ ]* 9.5 Write unit test for report format support
    - Test PDF generation
    - Test text format generation
    - _Requirements: 5.5_

- [ ] 10. Implement agent orchestrator
  - [ ] 10.1 Create Agent Orchestrator Lambda function
    - Implement request routing logic to appropriate Lambda functions
    - Implement Amazon Bedrock Agent integration with action groups
    - Configure action groups for Forecast, RAG, Report, and Sustainability
    - Implement context management for multi-turn conversations
    - Implement parallel execution for independent agents
    - Implement error handling with graceful degradation
    - Aggregate results from multiple agents
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [ ]* 10.2 Write property test for multi-component orchestration
    - **Property 21: Multi-Component Query Orchestration**
    - **Validates: Requirements 8.1**
  
  - [ ]* 10.3 Write property test for context preservation
    - **Property 22: Context Preservation Across Turns**
    - **Validates: Requirements 8.2**
  
  - [ ]* 10.4 Write property test for graceful failure handling
    - **Property 23: Graceful Agent Failure Handling**
    - **Validates: Requirements 8.4**
  
  - [ ]* 10.5 Write unit tests for orchestrator edge cases
    - Test with single agent query
    - Test with all agents failing
    - Test with partial failures
    - _Requirements: 8.4_

- [ ] 11. Implement voice processing
  - [ ] 11.1 Create Voice Lambda function
    - Implement Amazon Transcribe integration for audio-to-text
    - Support Hindi (hi-IN) and English (en-IN) languages
    - Implement query processing via Orchestrator Lambda
    - Implement Amazon Polly integration for text-to-speech
    - Configure Polly voices: Aditi (Hindi) and Raveena (English)
    - Add error handling for poor audio quality
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [ ]* 11.2 Write property test for voice transcription processing
    - **Property 15: Voice Transcription Processing**
    - **Validates: Requirements 6.1, 6.2**
  
  - [ ]* 11.3 Write property test for text-to-speech conversion
    - **Property 16: Text-to-Speech Conversion**
    - **Validates: Requirements 6.3**
  
  - [ ]* 11.4 Write unit tests for voice edge cases
    - Test with Hindi audio
    - Test with English audio
    - Test with poor quality audio
    - _Requirements: 6.4, 6.5_

- [ ] 12. Implement SMS interface
  - [ ] 12.1 Create SMS Lambda function
    - Implement SMS webhook handler for incoming messages
    - Implement command keyword parser (FORECAST, SCHEME, REPORT, HELP)
    - Implement routing to appropriate Lambda functions
    - Implement response formatting with 160-character limit
    - Implement ambiguity detection and clarification requests
    - Implement Amazon SNS integration for outbound SMS
    - Implement SMS interaction logging
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [ ]* 12.2 Write property test for SMS response length constraint
    - **Property 17: SMS Response Length Constraint**
    - **Validates: Requirements 7.2**
  
  - [ ]* 12.3 Write property test for SMS command routing
    - **Property 18: SMS Command Routing**
    - **Validates: Requirements 7.1**
  
  - [ ]* 12.4 Write property test for ambiguous SMS clarification
    - **Property 19: Ambiguous SMS Clarification**
    - **Validates: Requirements 7.4**
  
  - [ ]* 12.5 Write property test for SMS interaction logging
    - **Property 20: SMS Interaction Logging**
    - **Validates: Requirements 7.5**
  
  - [ ]* 12.6 Write unit tests for SMS commands
    - Test FORECAST command
    - Test SCHEME command
    - Test REPORT command
    - Test HELP command
    - _Requirements: 7.3_

- [ ] 13. Checkpoint - Ensure interface layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Implement cross-cutting concerns
  - [ ] 14.1 Implement audit logging utility
    - Create logging helper function for structured logs
    - Log authentication attempts, queries, AI interactions, report generation
    - Include timestamp, user ID, operation type, result status in all logs
    - Configure CloudWatch Logs retention (90 days)
    - _Requirements: 1.3, 11.4, 13.5_
  
  - [ ]* 14.2 Write property test for audit logging completeness
    - **Property 24: Audit Logging Completeness**
    - **Validates: Requirements 11.4, 13.5**
  
  - [ ] 14.3 Implement PII deletion utility
    - Create function to identify and delete PII from voice/SMS data
    - Implement session cleanup on expiration
    - Add DynamoDB TTL configuration for Sessions table
    - _Requirements: 11.5_
  
  - [ ]* 14.4 Write property test for PII deletion after session
    - **Property 25: PII Deletion After Session**
    - **Validates: Requirements 11.5**
  
  - [ ] 14.5 Implement retry logic with exponential backoff
    - Create retry decorator for Lambda functions
    - Implement exponential backoff (1s, 2s, 4s, 8s)
    - Configure maximum retry attempts (3)
    - _Requirements: 12.2_
  
  - [ ]* 14.6 Write property test for retry with exponential backoff
    - **Property 26: Retry with Exponential Backoff**
    - **Validates: Requirements 12.2**
  
  - [ ] 14.7 Implement error message formatter
    - Create function to convert technical errors to user-friendly messages
    - Map common error codes to helpful messages
    - Include suggested actions in error responses
    - _Requirements: 12.4_
  
  - [ ]* 14.8 Write property test for user-friendly error messages
    - **Property 27: User-Friendly Error Messages**
    - **Validates: Requirements 12.4**

- [ ] 15. Implement API Gateway and routing
  - [ ] 15.1 Define API Gateway in CDK
    - Create REST API with Lambda proxy integration
    - Define endpoints: /auth/login, /query, /forecast, /schemes, /report, /voice/transcribe, /voice/synthesize, /sms/receive
    - Configure CORS for web interface origin
    - Add API key requirement and usage plans
    - Configure request throttling (1000 req/sec per jurisdiction)
    - Add request/response logging
    - _Requirements: All (API layer for entire system)_
  
  - [ ] 15.2 Implement API Gateway authorizer
    - Create Lambda authorizer for JWT token validation
    - Extract jurisdiction from token claims
    - Add jurisdiction to request context
    - _Requirements: 1.2, 1.4_
  
  - [ ]* 15.3 Write integration tests for API endpoints
    - Test /auth/login with valid and invalid credentials
    - Test /query with authenticated request
    - Test /forecast endpoint
    - Test /schemes endpoint
    - Test /report endpoint
    - _Requirements: 1.1, 1.3, 2.1, 3.1, 5.1_

- [ ] 16. Implement web interface
  - [ ] 16.1 Create static web UI
    - Create HTML page with query input form
    - Implement JavaScript for API calls to API Gateway
    - Add authentication flow (login form, token storage)
    - Display forecast results with charts (Chart.js)
    - Display scheme results in formatted cards
    - Display recommendations with linked schemes
    - Add report download functionality
    - Add voice interface with audio recording
    - Style with minimal CSS for clean presentation
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1_
  
  - [ ] 16.2 Configure S3 static website hosting
    - Upload HTML/CSS/JS to S3 bucket
    - Configure bucket for static website hosting
    - Create CloudFront distribution for HTTPS
    - _Requirements: All (UI for entire system)_

- [ ] 17. Implement health checks and monitoring
  - [ ] 17.1 Create health check endpoints
    - Add /health endpoint to each Lambda function
    - Check DynamoDB connectivity
    - Check S3 connectivity
    - Check Bedrock API connectivity
    - Return status and component health
    - _Requirements: 12.5_
  
  - [ ] 17.2 Configure CloudWatch dashboards
    - Create dashboard with key metrics: requests/min, p99 latency, error rate
    - Add Lambda metrics: invocations, duration, errors, throttles
    - Add DynamoDB metrics: read/write capacity, throttles
    - Add API Gateway metrics: 4xx, 5xx errors, latency
    - _Requirements: 9.3, 10.1, 10.2, 10.3, 10.4_
  
  - [ ] 17.3 Configure CloudWatch alarms
    - Alarm for error rate > 1%
    - Alarm for p99 latency > 10 seconds
    - Alarm for Lambda throttling
    - Alarm for DynamoDB throttling
    - _Requirements: 12.1_

- [ ] 18. Create deployment and testing scripts
  - [ ] 18.1 Create CDK deployment script
    - Implement deploy.sh for automated deployment
    - Add environment variable configuration
    - Add pre-deployment validation
    - _Requirements: All (deployment for entire system)_
  
  - [ ] 18.2 Create data seeding script
    - Seed Users table with test accounts
    - Seed Schemes table with synthetic scheme documents
    - Upload historical data to S3
    - Generate and upload vector embeddings
    - _Requirements: 1.1, 2.2, 3.1_
  
  - [ ] 18.3 Create test execution script
    - Run all unit tests with pytest
    - Run all property-based tests with 100 iterations
    - Generate coverage report
    - _Requirements: All (testing for entire system)_

- [ ] 19. Final checkpoint - End-to-end testing
  - [ ] 19.1 Test complete query flow
    - Test web UI → API Gateway → Auth → Orchestrator → RAG → Response
    - Verify jurisdiction-based access control
    - Verify advisory disclaimers in responses
    - _Requirements: 1.2, 4.5, 8.1_
  
  - [ ] 19.2 Test voice flow
    - Test audio input → Transcribe → Query → Polly → Audio output
    - Test with Hindi and English
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [ ] 19.3 Test SMS flow
    - Test SMS webhook → Parse → Route → Process → SNS response
    - Test all command keywords
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [ ] 19.4 Test report generation flow
    - Test report request → Compile → Generate PDF → Store S3 → Return URL
    - Verify report contains all required sections
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [ ] 19.5 Verify all property tests pass
    - Run full property test suite with 100 iterations
    - Verify all 27 properties pass
    - _Requirements: All_

- [ ] 20. Create documentation and demo materials
  - [ ] 20.1 Create README with setup instructions
    - Document prerequisites (AWS account, CDK, Python)
    - Document deployment steps
    - Document testing procedures
    - Include architecture diagram
    - _Requirements: All_
  
  - [ ] 20.2 Create demo script for hackathon presentation
    - Prepare demo scenarios: forecast query, scheme search, report generation
    - Prepare voice demo with Hindi and English
    - Prepare SMS demo
    - Create slides explaining architecture and responsible AI approach
    - _Requirements: All_
  
  - [ ] 20.3 Create video demo (optional)
    - Record screen capture of web UI demo
    - Record voice interaction demo
    - Record SMS interaction demo
    - Edit into 5-minute demo video
    - _Requirements: All_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples, edge cases, and error conditions
- The implementation follows a bottom-up approach: data layer → intelligence → orchestration → interfaces
- All Lambda functions use Python 3.11 runtime
- Infrastructure is defined using AWS CDK (Python)
- Property-based testing uses Hypothesis library with minimum 100 iterations per test
- Integration tests verify end-to-end flows across multiple components
