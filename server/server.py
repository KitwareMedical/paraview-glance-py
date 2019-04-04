import sys

from wslink.websocket import ServerProtocol
from wslink import server

from protocol import Protocol

class AlgorithmServer(ServerProtocol):
    # TODO change this default secret
    authKey = 'wslink-secret'

    @staticmethod
    def configure(options):
        AlgorithmServer.authKey = options.authKey

    def initialize(self):
        self.registerLinkProtocol(Protocol())
        self.updateSecret(AlgorithmServer.authKey)

if __name__ == '__main__':
    server.start(['--content', 'www'], AlgorithmServer)
