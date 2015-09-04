# coding=utf-8
import asyncio
from datetime import datetime
import logging
from logging.handlers import SysLogHandler
import xml.etree.cElementTree as ET

from serial import FileLike
import serial
from tzlocal import get_localzone
from domopyc.daq.publishers.redis_publisher import create_redis_connection, RedisPublisher

CURRENT_COST = 'current_cost'

logging.basicConfig(format='%(asctime)s [%(name)s] %(levelname)s: %(message)s')
LOGGER = logging.getLogger('current_cost')
LOGGER.setLevel(logging.INFO)
LOGGER.addHandler(SysLogHandler())


CURRENT_COST_KEY = 'current_cost'


def now():
    return datetime.now(tz=get_localzone())

def create_current_cost(redis_connection, config):
    serial_drv = serial.Serial(config['device'], baudrate=57600,
                                   bytesize=serial.EIGHTBITS, parity=serial.PARITY_NONE, stopbits=serial.STOPBITS_ONE,
                                   timeout=10)
    LOGGER.info("create reader")
    return AsyncCurrentCostReader(serial_drv, RedisPublisher(redis_connection, CURRENT_COST_KEY))

class AsyncCurrentCostReader(FileLike):

    def __init__(self, drv, publisher, event_loop=asyncio.get_event_loop()):
        super().__init__()
        self.event_loop = event_loop
        self.publisher = publisher
        self.serial_drv = drv
        self.event_loop.add_reader(self.serial_drv.fd, self.read_callback)

    def read_callback(self):
        line = self.readline().decode().strip()
        LOGGER.debug('line : %s' % line)
        if line:
            try:
                xml_data = ET.fromstring(line)
                power_element = xml_data.find('ch1/watts')
                if power_element is not None:
                    power = int(power_element.text)
                    asyncio.async(self.publisher.publish({'date': now().isoformat(), 'watt': power,
                                                         'temperature': float(xml_data.find('tmpr').text)}))
            except ET.ParseError as xml_parse_error:
                LOGGER.exception(xml_parse_error)

    def read(self, bytes=1):
        return self.serial_drv.read(bytes)

    def remove_reader(self):
        self.event_loop.remove_reader(self.serial_drv.fd)
