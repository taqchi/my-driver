variable "ip" {
  default = []
}
variable "security_group_id" {}



resource "aws_security_group_rule" "add_custom_ingress" {
  for_each = toset(var.ip)

  type              = "ingress"
  from_port         = 22
  to_port           = 22
  protocol          = "tcp"
  security_group_id = var.security_group_id
  cidr_blocks       = ["${each.key}/32"]
  description       = "Allow ssh"
}
