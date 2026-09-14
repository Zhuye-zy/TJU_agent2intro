"""Offline annotated retrieval evaluation; no LLM/network and no online-status writes."""
import argparse,json
from pathlib import Path
from .service import LocalKnowledge,DATA_DIRECTORY
def evaluate():
    k=LocalKnowledge()
    questions=json.loads((DATA_DIRECTORY/"evaluation.json").read_text(encoding="utf-8"))["questions"]
    results=[]
    for q in questions:
        hits=k.search(q["query"],q["campus_id"],5)
        ids={s.id for s in hits}; expected=set(q["relevant_fact_ids"])
        if q["kind"]=="no_evidence":value=float(not hits)
        else:value=len(ids & expected)/len(expected)
        results.append({**q,"retrieved_ids":[s.id for s in hits],"recall_at_5":value,"pass":value==1})
    source_rows=[r for r in results if r["kind"]=="evidence"]
    other=[r for r in results if r["kind"]!="evidence"]
    return dict(data_version=k.get_status().version,scope="retrieval only; not model truth or browser QA",
                evidence_questions=len(source_rows),recall_at_5=sum(r["recall_at_5"] for r in source_rows)/len(source_rows),
                other_questions=len(other),other_pass=sum(r["pass"] for r in other),results=results)
def main():
    p=argparse.ArgumentParser();p.add_argument("--output",type=Path);args=p.parse_args()
    report=evaluate();text=json.dumps(report,ensure_ascii=False,indent=2)
    if args.output:args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(text+"\n",encoding="utf-8")
    print(json.dumps({k:v for k,v in report.items() if k!="results"},ensure_ascii=False))
if __name__=="__main__":main()
