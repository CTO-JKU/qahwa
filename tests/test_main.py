"""
This file contains tests for the functions in main.py.
GitHub Actions will run this file to verify that the code is working correctly.
It uses the pytest framework.
"""

from src.qahwa.main import add, subtract

def test_add():
    """
    Tests the add function with positive integers.
    """
    assert add(2, 3) is 5
    assert add(100, 1) is 101


def test_add_negative():
    """
    Tests the add function with negative numbers.
    """
    assert add(-1, -1) is -2
    assert add(-5, 5) is 0

def test_subtract():
    """
    Tests the subtract function.
    """
    assert subtract(10, 5) is 5
    assert subtract(5, 10) is -5
