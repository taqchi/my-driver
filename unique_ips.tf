module "share_sg" {
  source            = "./modules/sftp-sg/"
  security_group_id = var.security_group_id
  ip = [
  "10.0.0.1",
  "10.0.0.2",
  "10.0.0.3",
  "192.168.1.100",
  "192.168.1.101",
  "192.168.1.102",
   ]
}
