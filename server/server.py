import sys
import os

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
    static_dir = os.path.join(
            os.path.realpath(
                os.path.dirname(sys.argv[0])),
            'www')
    server.start(['--content', static_dir], AlgorithmServer)
