output "function_name" {
  value       = aws_lambda_function.docgen.function_name
  description = "For deploy.sh (aws lambda update-function-code) and manual on-demand invokes."
}

output "documents_bucket" {
  value       = aws_s3_bucket.documents.bucket
  description = "Where successfully generated documents land."
}
