terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.16"
    }
  }
  backend "s3" {
    bucket = "tf-state-20231222"
    key    = "staging/terraform20240130.tfstate"
    region = "us-west-2"
  }
  required_version = ">= 1.2.0"
}

provider "aws" {
  region = var.zone_name
  default_tags {
    tags = var.common_tags
  }
}

variable "zone_name" {
  type    = string
  default = "us-east-2"
}

variable "common_tags" {
  type = map(string)
  default = {
    Environment = "staging"
    CreateVia   = "terraform"
    CreateBy    = "Speedyrails"
  }
}

variable "security_group_id" {
  default = "sg-0084c5b9cf0e864da"
}

variable "transfer_server_id" {
  type    = string
  default = "s-c7357328617644488"
}

variable "s3_bucket_name" {
  type    = string
  default = "sftp-marori-ohio"
}
