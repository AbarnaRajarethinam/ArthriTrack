"""Provider seam: no sponsor endpoint or credentials are assumed."""
from typing import Protocol
from pydantic import BaseModel, ConfigDict
class Explanation(BaseModel):
    model_config=ConfigDict(extra='forbid')
    observation:str
    evidence:list[dict]
    limitations:str
    next_step:str
    questions:list[str]
    provider:str
class ExplanationProvider(Protocol):
    def generate(self,approved:Explanation)->Explanation: ...
class DeterministicProvider:
    def generate(self,approved:Explanation)->Explanation: return approved
def validated_explanation(data:dict,provider:ExplanationProvider|None=None)->dict:
    approved=Explanation.model_validate(data)
    try:
        output=Explanation.model_validate((provider or DeterministicProvider()).generate(approved.model_copy(deep=True)))
        # No external paraphrasing until a reviewed content policy exists.
        if output.model_dump()!=approved.model_dump(): return approved.model_dump()
        return output.model_dump()
    except Exception: return approved.model_dump()
