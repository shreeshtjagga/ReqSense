import logging
import os
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

def get_s3_client():
    # Detect mock mode
    is_mock = (
        not settings.S3_ACCESS_KEY_ID or
        settings.S3_ACCESS_KEY_ID.startswith("test") or
        settings.S3_ACCESS_KEY_ID.startswith("mock")
    )
    if is_mock:
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


class StorageService:
    @staticmethod
    def upload_srs(local_file_path: str, project_id: str, version: str) -> str:
        """
        Uploads local file to S3/R2.
        Returns the object URL / S3 key.
        """
        s3_key = f"projects/{project_id}/srs_{version}.docx"
        s3 = get_s3_client()

        if s3 is None:
            # Mock upload
            logger.info(f"[MOCK STORAGE] Uploading {local_file_path} to {s3_key}")
            # Ensure local mock storage directory exists
            mock_dir = os.path.join(os.path.dirname(local_file_path), "..", "mock_s3")
            os.makedirs(mock_dir, exist_ok=True)
            # Just return the key as URL
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
        Generates a presigned S3/R2 download URL for the document.
        """
        s3 = get_s3_client()
        if s3 is None:
            logger.info(f"[MOCK STORAGE] Generating presigned URL for {s3_key}")
            # Simulate a presigned URL
            return f"{settings.FRONTEND_URL}/mock-download/{s3_key}?expires={expires_in}"

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
            raise e
