module "sftp_johndoe" {
  source         = "./modules/sftp/"
  user_name      = "johndoe"
  s3_bucket_name = var.s3_bucket_name
  transfer_server_id = var.transfer_server_id
  path = [
    "/home/john",
    "/mnt/data",
  ]
  client_ip = [
    "10.0.0.1",
    "10.0.0.2",
    "10.0.0.3",
  ]
  ssh_public_key = [
    "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQD3example3 user2@host",
    "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQD4example4 user2@host",
  ]
}
