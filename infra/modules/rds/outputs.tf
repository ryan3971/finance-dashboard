output "db_endpoint" {
  description = "Hostname of the RDS instance endpoint (without port)"
  value       = aws_db_instance.this.address
}

output "db_port" {
  description = "Port the RDS instance listens on"
  value       = aws_db_instance.this.port
}

output "db_name" {
  description = "Name of the initial database"
  value       = aws_db_instance.this.db_name
}

output "db_username" {
  description = "Master username for the RDS instance"
  value       = aws_db_instance.this.username
}

output "rds_security_group_id" {
  description = "ID of the security group attached to the RDS instance"
  value       = aws_security_group.rds.id
}
