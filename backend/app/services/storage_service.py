import logging
import os
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

def get_s3_client():
    if settings.s3_is_mocked:
        return None

    config = Config(
        connect_timeout=settings.S3_TIMEOUT_SECONDS,
        read_timeout=settings.S3_TIMEOUT_SECONDS,
        retries={"max_attempts": 3}
    )

    kwargs = {
        "aws_access_key_id": settings.S3_ACCESS_KEY_ID,
        "aws_secret_access_key": settings.S3_SECRET_ACCESS_KEY,
        "config": config
    }

    if settings.S3_ENDPOINT_URL:
        kwargs["endpoint_url"] = settings.S3_ENDPOINT_URL
    if settings.S3_REGION:
        kwargs["region_name"] = settings.S3_REGION

    return boto3.client("s3", **kwargs)


import shutil
from pathlib import Path

_BASE_DIR = Path(__file__).resolve().parent.parent.parent

class StorageService:
    @staticmethod
    def upload_srs(local_file_path: str, project_id: str, version: str) -> str:
        """
        Uploads local file to S3/R2 or stores in persistent local mock storage.
        Returns the object URL / S3 key.
        """
        s3_key = f"projects/{project_id}/srs_{version}.docx"
        s3 = get_s3_client()

        if s3 is None:
            logger.info(f"[MOCK STORAGE] Saving {local_file_path} to storage_files/{s3_key}")
            target_path = _BASE_DIR / "storage_files" / s3_key
            target_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(local_file_path, target_path)
            return s3_key

        try:
            s3.upload_file(
                Filename=local_file_path,
                Bucket=settings.S3_BUCKET_NAME,
                Key=s3_key
            )
            logger.info(f"Uploaded SRS document to S3: {s3_key}")
            return s3_key
        except ClientError as e:
            logger.error(f"Failed to upload SRS document to S3: {e}")
            raise e

    @staticmethod
    def get_download_url(s3_key: str, expires_in: int = 3600) -> str:
        """
        Generates a download URL for the document (presigned S3 or local download endpoint).
        """
        s3 = get_s3_client()
        if s3 is None:
            logger.info(f"[MOCK STORAGE] Returning download endpoint for {s3_key}")
            return f"/api/v1/srs/download-file?key={s3_key}"

        try:
            url = s3.generate_presigned_url(
                ClientMethod="get_object",
                Params={
                    "Bucket": settings.S3_BUCKET_NAME,
                    "Key": s3_key
                },
                ExpiresIn=expires_in
            )
            return url
        except ClientError as e:
            logger.error(f"Failed to generate presigned URL: {e}")
            return f"/api/v1/srs/download-file?key={s3_key}"
