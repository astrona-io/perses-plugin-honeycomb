"""Serves a fixed, made-up cluster as kube-state-metrics and node metrics on :8000/metrics.

Only for the dev stack: it gives the dashboards in provisioning/ something to draw without a
cluster. Every name is invented.
"""

import random
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

rng = random.Random(7)
NODES = ["node-a", "node-b", "node-c", "node-d", "node-e"]

# namespace -> [(kind, name, pods, odd states)]. Odd states replace the state of the first pods.
WORKLOADS = {
    "shop": [
        ("Deployment", "storefront", 6, []),
        ("Deployment", "cart", 3, []),
        ("Deployment", "checkout", 3, ["CrashLoopBackOff"]),
        ("Deployment", "search", 4, []),
        ("StatefulSet", "catalog-db", 3, []),
        ("Deployment", "recommendations", 2, ["Pending"]),
    ],
    "data": [
        ("StatefulSet", "postgres", 3, []),
        ("StatefulSet", "kafka", 3, []),
        ("Deployment", "schema-registry", 2, []),
        ("CronJob", "nightly-export", 1, ["Failed"]),
    ],
    "api": [
        ("Deployment", "gateway", 12, []),
        ("Deployment", "accounts", 4, ["ImagePullBackOff"]),
        ("Deployment", "orders", 5, []),
    ],
    "monitoring": [
        ("StatefulSet", "prometheus", 2, []),
        ("Deployment", "alertmanager", 1, []),
        ("DaemonSet", "node-exporter", 5, []),
    ],
    "kube-system": [
        ("Deployment", "coredns", 2, []),
        ("DaemonSet", "kube-proxy", 5, []),
        ("DaemonSet", "cni-agent", 5, ["ContainerCreating"]),
        ("Node", "etcd", 3, []),
    ],
    "batch": [
        ("CronJob", "report", 2, ["Pending"]),
        ("Deployment", "worker", 3, []),
    ],
}
PHASE_OF = {"CrashLoopBackOff": "Running", "ImagePullBackOff": "Pending", "ContainerCreating": "Pending"}
PHASES = ["Pending", "Running", "Succeeded", "Failed", "Unknown"]


def suffix(n: int) -> str:
    return "".join(rng.choice("bcdfghjklmnpqrstvwxz2456789") for _ in range(n))


def render() -> str:
    lines = [
        "# TYPE kube_pod_status_phase gauge",
        "# TYPE kube_pod_container_status_waiting_reason gauge",
        "# TYPE kube_pod_owner gauge",
        "# TYPE kube_replicaset_owner gauge",
        "# TYPE kube_job_owner gauge",
        "# TYPE kube_pod_info gauge",
    ]
    for ns, workloads in WORKLOADS.items():
        for kind, name, count, odd in workloads:
            owner_kind, owner = kind, name
            if kind == "Deployment":
                owner_kind, owner = "ReplicaSet", f"{name}-{suffix(9)}"
                lines.append(f'kube_replicaset_owner{{namespace="{ns}",replicaset="{owner}",owner_kind="Deployment",owner_name="{name}"}} 1')
            for i in range(count):
                node = NODES[i % len(NODES)]
                if kind == "CronJob":
                    owner_kind, owner = "Job", f"{name}-{29000000 + i}"
                    lines.append(f'kube_job_owner{{namespace="{ns}",job_name="{owner}",owner_kind="CronJob",owner_name="{name}"}} 1')
                    pod = f"{owner}-{suffix(5)}"
                elif kind == "StatefulSet":
                    pod = f"{name}-{i}"
                elif kind == "Node":
                    owner = node
                    pod = f"{name}-{node}"
                else:
                    pod = f"{owner}-{suffix(5)}"
                state = odd[i] if i < len(odd) else "Running"
                phase = PHASE_OF.get(state, state)
                for p in PHASES:
                    lines.append(f'kube_pod_status_phase{{namespace="{ns}",pod="{pod}",phase="{p}"}} {int(p == phase)}')
                if state not in PHASES:
                    lines.append(f'kube_pod_container_status_waiting_reason{{namespace="{ns}",pod="{pod}",container="main",reason="{state}"}} 1')
                lines.append(f'kube_pod_owner{{namespace="{ns}",pod="{pod}",owner_kind="{owner_kind}",owner_name="{owner}"}} 1')
                lines.append(f'kube_pod_info{{namespace="{ns}",pod="{pod}",node="{node}"}} 1')
    lines.append("# TYPE node_cpu_utilisation_percent gauge")
    for node, cpu in zip(NODES, [34, 58, 76, 22, 93]):
        lines.append(f'node_cpu_utilisation_percent{{node="{node}"}} {cpu}')
    return "\n".join(lines) + "\n"


BODY = render().encode()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path != "/metrics":
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; version=0.0.4")
        self.end_headers()
        self.wfile.write(BODY)

    def log_message(self, *args: object) -> None:
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("", 8000), Handler).serve_forever()
