#!/usr/bin/env python3
import os
import posixpath
import socket
import sys
from ftplib import FTP, error_perm

HOST = "gogx.myjino.ru"
PASSWORD = os.environ["SSHPASS"]


def ipv4(host: str) -> str:
    return socket.getaddrinfo(host, None, socket.AF_INET, socket.SOCK_STREAM)[0][4][0]
USERS = ["gogx_arsenal22", "arsenal22", "gogx-arsenal22"]
SKIP_NAMES = {".git", ".github", ".gitignore", ".DS_Store"}
LOCAL_ROOT = os.getcwd()

DANGEROUS = ("index.php", "passenger_wsgi.py")


def log(msg: str) -> None:
    print(msg, flush=True)


def should_skip(name: str) -> bool:
    return name in SKIP_NAMES or name.startswith(".git")


def local_files():
    for dirpath, dirnames, filenames in os.walk(LOCAL_ROOT):
        dirnames[:] = [d for d in dirnames if not should_skip(d)]
        for name in filenames:
            if should_skip(name):
                continue
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, LOCAL_ROOT).replace(os.sep, "/")
            yield full, rel


def choose_target(names: list[str], cwd: str) -> str:
    lower = {posixpath.basename(n.rstrip("/")) for n in names}
    if "domains" in lower:
        return "domains/arsenal22.ru"
    if "arsenal22.ru" in lower:
        return "arsenal22.ru"
    if "index.html" in lower or cwd.rstrip("/").endswith("arsenal22.ru"):
        return "."
    return "domains/arsenal22.ru"


class SftpClient:
    def __init__(self, user: str, port: int, transport, sftp):
        self.user = user
        self.port = port
        self.proto = "sftp"
        self.transport = transport
        self.sftp = sftp

    def listdir(self, path="."):
        return self.sftp.listdir(path)

    def getcwd(self):
        return self.sftp.normalize(".")

    def makedirs(self, path: str):
        if path in ("", ".", "/"):
            return
        parts = [p for p in path.strip("/").split("/") if p]
        cur = "/" if path.startswith("/") else ""
        for part in parts:
            cur = posixpath.join(cur, part) if cur else part
            try:
                self.sftp.stat(cur)
            except FileNotFoundError:
                self.sftp.mkdir(cur)

    def chdir(self, path: str):
        self.sftp.chdir(path)

    def put(self, local: str, remote: str):
        remote_dir = posixpath.dirname(remote)
        if remote_dir and remote_dir not in (".", "/"):
            self.makedirs(remote_dir)
        self.sftp.put(local, remote)

    def rename_if_exists(self, src: str, dst: str):
        try:
            self.sftp.stat(src)
        except FileNotFoundError:
            return
        try:
            self.sftp.remove(dst)
        except FileNotFoundError:
            pass
        self.sftp.rename(src, dst)

    def close(self):
        self.sftp.close()
        self.transport.close()


class FtpClient:
    def __init__(self, user: str, ftp: FTP):
        self.user = user
        self.port = 21
        self.proto = "ftp"
        self.ftp = ftp

    def listdir(self, path="."):
        try:
            return self.ftp.nlst(path)
        except error_perm:
            return []

    def getcwd(self):
        return self.ftp.pwd()

    def makedirs(self, path: str):
        if path in ("", ".", "/"):
            return
        parts = path.strip("/").split("/")
        cur = ""
        for part in parts:
            cur = f"{cur}/{part}" if cur else part
            try:
                self.ftp.mkd(cur)
            except error_perm:
                pass

    def chdir(self, path: str):
        self.ftp.cwd(path)

    def put(self, local: str, remote: str):
        remote_dir = posixpath.dirname(remote)
        if remote_dir and remote_dir not in (".", "/"):
            self.makedirs(remote_dir)
        with open(local, "rb") as fh:
            self.ftp.storbinary(f"STOR {remote}", fh)

    def rename_if_exists(self, src: str, dst: str):
        try:
            self.ftp.rename(src, dst)
        except error_perm:
            pass

    def close(self):
        try:
            self.ftp.quit()
        except Exception:
            self.ftp.close()


def try_sftp(user: str, port: int):
    import paramiko

    ip = ipv4(HOST)
    log(f">>> SFTP {port} {user} via {ip}")
    sock = socket.create_connection((ip, port), timeout=12)
    sock.settimeout(20)
    transport = paramiko.Transport(sock)
    transport.banner_timeout = 12
    transport.auth_timeout = 12
    transport.connect(username=user, password=PASSWORD)
    sftp = paramiko.SFTPClient.from_transport(transport)
    client = SftpClient(user, port, transport, sftp)
    cwd = client.getcwd()
    names = client.listdir(".")
    log(f"pwd={cwd}")
    log(f"ls={names[:40]}")
    return client


def try_ftp(user: str):
    ip = ipv4(HOST)
    log(f">>> FTP 21 {user} via {ip}")
    ftp = FTP()
    ftp.connect(ip, 21, timeout=15)
    ftp.login(user, PASSWORD)
    ftp.set_pasv(True)
    client = FtpClient(user, ftp)
    cwd = client.getcwd()
    names = client.listdir(".")
    log(f"pwd={cwd}")
    log(f"ls={names[:40]}")
    return client


def connect():
    last_error = None
    for user in USERS:
        for port in (2222, 22):
            try:
                return try_sftp(user, port)
            except Exception as exc:
                last_error = exc
                log(f"failed: SFTP {port} {user}: {type(exc).__name__}: {exc}")
        try:
            return try_ftp(user)
        except Exception as ext:
            last_error = ext
            log(f"failed: FTP 21 {user}: {type(ext).__name__}: {ext}")
    raise SystemExit(f"All login variants failed: {last_error}")


def deploy(client):
    names = client.listdir(".")
    cwd = client.getcwd()
    target = choose_target(names, cwd)
    log(f"Using {client.proto} as {client.user} target={target}")
    if target not in (".",):
        client.makedirs(target)
        client.chdir(target)
        log(f"chdir {target} -> {client.getcwd()}")
    uploaded = 0
    for local, rel in local_files():
        log(f"put {rel}")
        client.put(local, rel)
        uploaded += 1
    for name in DANGEROUS:
        client.rename_if_exists(name, f"{name}.bak")
    log(f"uploaded {uploaded} files")
    log(f"final ls={client.listdir('.')[:60]}")
    client.close()


def main():
    if not PASSWORD:
        raise SystemExit("SSHPASS is empty")
    log(f"password_len={len(PASSWORD)}")
    client = connect()
    deploy(client)
    log("deploy finished")


if __name__ == "__main__":
    sys.exit(main())
