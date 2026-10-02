# Event-driven order intake on Google Cloud: Cloud Run API behind a load balancer, Pub/Sub, a processor function and BigQuery.
resource "google_compute_network" "main" {
  name                    = "orders"
  auto_create_subnetworks = false
}

resource "google_vpc_access_connector" "run" {
  name          = "run-connector"
  region        = var.region
  network       = google_compute_network.main.name
  ip_cidr_range = "10.8.0.0/28"
}

resource "google_cloud_run_v2_service" "api" {
  name     = "orders-api"
  location = var.region
  template {
    containers { image = "us-docker.pkg.dev/${var.project}/apps/orders-api" }
    vpc_access { connector = google_vpc_access_connector.run.id }
  }
}

resource "google_compute_security_policy" "edge" {
  name = "orders-edge"
}

resource "google_compute_global_forwarding_rule" "lb" {
  name   = "orders-lb"
  target = google_cloud_run_v2_service.api.uri
}

resource "google_pubsub_topic" "orders" {
  name = "orders"
}

resource "google_pubsub_subscription" "orders_to_fn" {
  name  = "orders-to-processor"
  topic = google_pubsub_topic.orders.name
  push_config { push_endpoint = google_cloudfunctions2_function.processor.url }
}

resource "google_cloudfunctions2_function" "processor" {
  name     = "order-processor"
  location = var.region
  build_config { runtime = "python312" }
}

resource "google_firestore_database" "orders" {
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"
  depends_on  = [google_cloud_run_v2_service.api]
}

resource "google_bigquery_dataset" "analytics" {
  dataset_id = "order_analytics"
  location   = "US"
  depends_on = [google_cloudfunctions2_function.processor]
}

resource "google_project_iam_member" "api_firestore" {
  project = var.project
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_cloud_run_v2_service.api.name}"
}
