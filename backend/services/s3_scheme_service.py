import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List
from uuid import uuid4

import boto3
from botocore.exceptions import ClientError

from config import settings

logger = logging.getLogger(__name__)


class S3SchemeService:
    def __init__(self):
        self.region = settings.AWS_REGION
        self.bucket = settings.S3_SCHEMES_BUCKET
        self.prefix = settings.S3_SCHEMES_PREFIX.strip("/")
        self.local_schemes_dir = Path(__file__).resolve().parents[2] / "resources" / "schemes"
        self.s3 = self._create_client()

    def _create_client(self):
        client_kwargs = {"region_name": self.region}

        if settings.AWS_PROFILE:
            session = boto3.Session(profile_name=settings.AWS_PROFILE)
            client_factory = session.client
        else:
            client_factory = boto3.client

        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            client_kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
            client_kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY

        if settings.AWS_SESSION_TOKEN:
            client_kwargs["aws_session_token"] = settings.AWS_SESSION_TOKEN

        return client_factory("s3", **client_kwargs)

    def _object_key(self, filename: str) -> str:
        return f"{self.prefix}/{filename}" if self.prefix else filename

    def ensure_bucket_exists(self) -> None:
        try:
            self.s3.head_bucket(Bucket=self.bucket)
            return
        except ClientError as e:
            status = (e.response or {}).get("ResponseMetadata", {}).get("HTTPStatusCode")
            if status not in {400, 403, 404}:
                raise

        try:
            create_kwargs = {"Bucket": self.bucket}
            if self.region != "us-east-1":
                create_kwargs["CreateBucketConfiguration"] = {"LocationConstraint": self.region}
            self.s3.create_bucket(**create_kwargs)
            logger.info("Created S3 bucket for schemes: %s", self.bucket)
        except ClientError as e:
            code = (e.response or {}).get("Error", {}).get("Code", "")
            if code in {"BucketAlreadyOwnedByYou"}:
                return
            raise

    def _list_existing_keys(self) -> set[str]:
        existing = set()
        continuation_token = None
        while True:
            params = {"Bucket": self.bucket, "Prefix": f"{self.prefix}/" if self.prefix else ""}
            if continuation_token:
                params["ContinuationToken"] = continuation_token
            response = self.s3.list_objects_v2(**params)
            for obj in response.get("Contents", []):
                key = obj.get("Key", "")
                if key.lower().endswith(".pdf"):
                    existing.add(key)
            if not response.get("IsTruncated"):
                break
            continuation_token = response.get("NextContinuationToken")
        return existing

    def sync_local_pdfs(self) -> Dict[str, int]:
        self.ensure_bucket_exists()

        if not self.local_schemes_dir.exists():
            logger.warning("Local schemes folder not found: %s", self.local_schemes_dir)
            return {"local_files": 0, "uploaded": 0}

        local_files = sorted([path for path in self.local_schemes_dir.glob("*.pdf") if path.is_file()])
        existing_keys = self._list_existing_keys()

        uploaded = 0
        for pdf_path in local_files:
            key = self._object_key(pdf_path.name)
            if key in existing_keys:
                continue
            self.s3.upload_file(
                Filename=str(pdf_path),
                Bucket=self.bucket,
                Key=key,
                ExtraArgs={"ContentType": "application/pdf"},
            )
            uploaded += 1

        return {"local_files": len(local_files), "uploaded": uploaded}

    def list_scheme_pdfs(self, expires_in_seconds: int = 3600) -> List[Dict]:
        self.ensure_bucket_exists()

        files: List[Dict] = []
        continuation_token = None
        while True:
            params = {"Bucket": self.bucket, "Prefix": f"{self.prefix}/" if self.prefix else ""}
            if continuation_token:
                params["ContinuationToken"] = continuation_token
            response = self.s3.list_objects_v2(**params)

            for obj in response.get("Contents", []):
                key = obj.get("Key", "")
                if not key or key.endswith("/"):
                    continue

                object_basename = key.split("/")[-1]
                head = self.s3.head_object(Bucket=self.bucket, Key=key)
                metadata = head.get("Metadata", {}) or {}

                original_filename = metadata.get("original_filename", object_basename)
                title = metadata.get("title", Path(original_filename).stem)
                content_type = head.get("ContentType") or "application/octet-stream"

                download_url = self.s3.generate_presigned_url(
                    "get_object",
                    Params={
                        "Bucket": self.bucket,
                        "Key": key,
                        "ResponseContentType": content_type,
                        "ResponseContentDisposition": f'attachment; filename="{original_filename}"',
                    },
                    ExpiresIn=expires_in_seconds,
                )

                files.append(
                    {
                        "title": title,
                        "file_name": original_filename,
                        "s3_key": key,
                        "content_type": content_type,
                        "size_bytes": int(obj.get("Size", 0)),
                        "last_modified": (
                            obj.get("LastModified").isoformat()
                            if isinstance(obj.get("LastModified"), datetime)
                            else None
                        ),
                        "download_url": download_url,
                    }
                )

            if not response.get("IsTruncated"):
                break
            continuation_token = response.get("NextContinuationToken")

        files.sort(key=lambda x: x["file_name"].lower())
        return files

    def upload_scheme_file(self, file_bytes: bytes, original_filename: str, title: str = "") -> Dict:
        self.ensure_bucket_exists()

        filename = Path(original_filename).name
        safe_filename = filename.replace(" ", "_")
        key = self._object_key(f"uploads/{uuid4().hex}_{safe_filename}")
        display_title = (title or "").strip() or Path(filename).stem
        ext = Path(filename).suffix.lower()

        content_type_map = {
            ".pdf": "application/pdf",
            ".doc": "application/msword",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xls": "application/vnd.ms-excel",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".csv": "text/csv",
            ".txt": "text/plain",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".json": "application/json",
        }
        content_type = content_type_map.get(ext, "application/octet-stream")

        self.s3.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=file_bytes,
            ContentType=content_type,
            Metadata={
                "title": display_title,
                "original_filename": filename,
            },
        )

        download_url = self.s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": self.bucket,
                "Key": key,
                "ResponseContentType": content_type,
                "ResponseContentDisposition": f'attachment; filename="{filename}"',
            },
            ExpiresIn=3600,
        )

        return {
            "title": display_title,
            "file_name": filename,
            "s3_key": key,
            "content_type": content_type,
            "size_bytes": len(file_bytes),
            "download_url": download_url,
        }


s3_scheme_service = S3SchemeService()
