import pytest
from app.service import Actor, CareNoteService

@pytest.fixture
def svc(): return CareNoteService().seed()
@pytest.fixture
def clinician(): return Actor("dr-1","clinician","clinic-a")
@pytest.fixture
def staff(): return Actor("nurse-1","staff","clinic-a")
