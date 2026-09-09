data "aws_caller_identity" "current" {}

# --- Documents bucket -------------------------------------------------------

# S3 bucket names are globally unique across every AWS account, not just this
# one — a plain "${var.project}-documents" would collide the moment a second
# person deployed this example. The random suffix avoids that.
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "documents" {
  bucket = "${var.project}-documents-${random_id.bucket_suffix.hex}"
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket                  = aws_s3_bucket.documents.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# This is a demo generating synthetic documents nightly, forever, with no
# reason to keep them — expire quickly so it doesn't quietly accumulate junk
# (and cost) the longer someone leaves it deployed.
resource "aws_s3_bucket_lifecycle_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    id     = "expire-documents"
    status = "Enabled"

    filter {}

    expiration {
      days = 7
    }
  }
}

# --- Lambda IAM --------------------------------------------------------------

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "docgen" {
  name               = var.project
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy" "docgen" {
  role = aws_iam_role.docgen.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Write-only: this Lambda creates documents, never reads or lists
        # them back — the dashboard and Omnilog get the record via OTLP, not
        # via S3.
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = ["${aws_s3_bucket.documents.arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.project}-*"
      }
    ]
  })
}

# --- Lambda function ---------------------------------------------------------

# Infrastructure only — the real bundle (dist/index.js, esbuild-bundled) is
# owned by deploy.sh via `aws lambda update-function-code`, same
# bootstrap-zip + ignore_changes split omnilog-infra uses for its own
# Node.js Lambdas (see query's deploy.sh in the sibling omnilog-query repo).
data "archive_file" "docgen_bootstrap" {
  type        = "zip"
  output_path = "${path.root}/.build/docgen-bootstrap.zip"
  source {
    content  = "exports.handler = async () => { throw new Error('nightly-docgen code not deployed — run deploy.sh from the nightly-docgen directory'); };\n"
    filename = "index.js"
  }
}

resource "aws_lambda_function" "docgen" {
  function_name    = var.project
  role             = aws_iam_role.docgen.arn
  runtime          = "nodejs22.x"
  handler          = "index.handler"
  filename         = data.archive_file.docgen_bootstrap.output_path
  source_code_hash = data.archive_file.docgen_bootstrap.output_base64sha256
  # A tick generates docs_per_tick documents, each a few spans/logs/a metric
  # and one real S3 PutObject — generous relative to that, well inside
  # Lambda's 900s hard ceiling.
  timeout     = 300
  memory_size = 256

  environment {
    variables = {
      OTEL_SERVICE_NAME           = "nightly-docgen"
      OTEL_EXPORTER_OTLP_ENDPOINT = var.otel_exporter_otlp_endpoint
      OTEL_EXPORTER_OTLP_HEADERS  = var.otel_exporter_otlp_headers
      DOCUMENTS_BUCKET            = aws_s3_bucket.documents.bucket
      TOTAL_DOCS                  = tostring(var.total_docs)
      TICK_MINUTES                = tostring(var.tick_minutes)
      WINDOW_START_HOUR           = tostring(var.window_start_hour)
      WINDOW_END_HOUR             = tostring(var.window_end_hour)
      FAILURE_RATE                = tostring(var.failure_rate)
    }
  }

  # Code is owned by deploy.sh, not Terraform.
  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

# --- Schedule ------------------------------------------------------------

# Fires all day, every day — the handler itself no-ops outside
# WINDOW_START_HOUR/WINDOW_END_HOUR, so the rule doesn't need to encode the
# window (and can't easily: rate() has no time-of-day concept, and a cron()
# window would have to be re-expressed by hand every time the window
# variables change).
resource "aws_cloudwatch_event_rule" "docgen_tick" {
  name                = "${var.project}-tick"
  description         = "Nightly-docgen tick — the Lambda no-ops outside its configured window."
  schedule_expression = "rate(${var.tick_minutes} minutes)"
}

resource "aws_cloudwatch_event_target" "docgen_tick" {
  rule = aws_cloudwatch_event_rule.docgen_tick.name
  arn  = aws_lambda_function.docgen.arn
}

resource "aws_lambda_permission" "docgen_tick" {
  statement_id  = "AllowEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.docgen.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.docgen_tick.arn
}
