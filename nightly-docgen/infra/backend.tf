# Separate state from the core omnilog-infra stack (different key, same
# bucket) — this example is deployed independently, on its own apply, not as
# part of the managed stack. The region is hardcoded because backend blocks
# don't support variable interpolation — they're evaluated before any
# variables are resolved.
terraform {
  backend "s3" {
    bucket       = "omnilog-terraform-state"
    key          = "omnilog/nightly-docgen/terraform.tfstate"
    region       = "eu-west-2"
    use_lockfile = true
    encrypt      = true
  }
}
