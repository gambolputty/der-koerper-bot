# %%
from configparser import ConfigParser, ExtendedInterpolation
from pathlib import Path

config = ConfigParser(interpolation=ExtendedInterpolation())
config.read(Path(__file__).parent.parent / "config.cfg")
