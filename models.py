from sqlalchemy import Column, Integer, String, Numeric
from database import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    family = Column(String, index=True)
    spec = Column(String)
    make = Column(String, index=True)
    stock = Column(Integer, default=0)
    price = Column(Numeric(10, 2))
