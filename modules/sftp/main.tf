variable "ssh_public_key" {}
variable "user_name" {}
variable "path" {}
variable "client_ip" {}
variable "transfer_server_id" {}
variable "s3_bucket_name" {}

resource "aws_iam_role" "transfer_family_role" {
  name = "transfer_family_role_for_user_${var.user_name}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Service = "transfer.amazonaws.com"
        },
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_policy" "transfer_family_policy" {
  name        = "transfer_family_policy_for_user_${var.user_name}"
  description = "Access policy for Transfer Family user ${var.user_name}"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid    = "ListBucket",
        Effect = "Allow",
        Action = [
          "s3:ListBucket"
        ],
        Resource = "arn:aws:s3:::${var.s3_bucket_name}"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "attach_policy" {
  role       = aws_iam_role.transfer_family_role.name
  policy_arn = aws_iam_policy.transfer_family_policy.arn
}


data "aws_iam_policy_document" "transfer_family_for_path_policy" {
  dynamic "statement" {
    for_each = var.path
    content {
      effect = "Allow"
      actions = [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ]
      resources = [
        "arn:aws:s3:::${var.s3_bucket_name}${statement.value}/*"
      ]
    }
  }
}

resource "aws_iam_policy" "policy_for_path" {
  name   = "transfer_family_policy_for_user_${var.user_name}_for_paths"
  policy = data.aws_iam_policy_document.transfer_family_for_path_policy.json
}
resource "aws_iam_role_policy_attachment" "attach_policy_path" {
  role       = aws_iam_role.transfer_family_role.name
  policy_arn = aws_iam_policy.policy_for_path.arn
}


resource "aws_transfer_user" "sftp_user" {
  server_id      = var.transfer_server_id
  user_name      = var.user_name
  role           = aws_iam_role.transfer_family_role.arn
  home_directory = "/${var.s3_bucket_name}${var.path[0]}"
}

resource "aws_transfer_ssh_key" "sftp_key_loop" {
  for_each = toset(var.ssh_public_key)

  user_name = aws_transfer_user.sftp_user.user_name
  server_id = var.transfer_server_id
  body      = each.key
}




