import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const client = new S3Client({});

export async function putDocument(bucket, key, body) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(body),
      ContentType: "application/json",
    }),
  );
}
