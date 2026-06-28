# backend/api/algorithms.py
from __future__ import annotations
from fastapi import APIRouter
import oqs

router = APIRouter()

@router.get("/algorithms/supported")
def get_supported_algorithms():
    return {
        "kem": sorted(list(oqs.get_enabled_kem_mechanisms())),
        "signature": sorted(list(oqs.get_enabled_sig_mechanisms())),
        "liboqs_version": "0.10.1",
    }
