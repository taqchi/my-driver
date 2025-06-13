module "sftp_janedoe" {
  source         = "./modules/sftp/"
  user_name      = "janedoe"
  s3_bucket_name = var.s3_bucket_name
  transfer_server_id = var.transfer_server_id
  path = [
    "/srv/jane",
    "/srv/backup",
  ]
  client_ip = [
    "192.168.1.100",
    "192.168.1.101",
    "192.168.1.102",
  ]
  ssh_public_key = [
    "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQD5example5 user3@host",
    "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQD6example6 user3@host",
  ]
}
