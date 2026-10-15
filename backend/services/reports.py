from io import BytesIO
from html import escape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle
def make_pdf(report):
    output=BytesIO(); styles=getSampleStyleSheet(); story=[]
    def p(text,style='BodyText'): story.append(Paragraph(escape(str(text)).replace('\n','<br/>'),styles[style])); story.append(Spacer(1,8))
    p('ArthriTrack | Appointment summary','Title'); p('DEMO DATA - SYNTHETIC EXAMPLES' if report['mode']=='demo' else 'Personal self-care record','Heading2')
    p(f"Identifier: {report['identifier'] or 'Not provided'} | {report['start']} to {report['end']}")
    for kind,label,fields in [('assessments','Camera-estimated movement',['recorded_at','hand','assessment_type','range_of_motion','quality_status']),('symptoms','Self-reported symptoms',['recorded_at','hand','pain_level','stiffness_level']),('routines','User-entered prescribed routines',['item_name','instructions','reminder_time']),('logs','Self-reported routine history',['scheduled_date','routine_id','status','reason'])]:
        if kind not in report: continue
        p(label,'Heading2')
        if not report[kind]: p('No records in the selected range.'); continue
        data=[[Paragraph(f.replace('_',' '),styles['BodyText']) for f in fields]]
        for row in report[kind]: data.append([Paragraph(escape(str(row.get(f,''))),styles['BodyText']) for f in fields])
        table=Table(data,colWidths=[480/len(fields)]*len(fields),repeatRows=1,hAlign='LEFT'); table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#DDF4F0')),('VALIGN',(0,0),(-1,-1),'TOP'),('BOTTOMPADDING',(0,0),(-1,-1),8),('LINEBELOW',(0,0),(-1,-1),.3,colors.lightgrey)])); story.append(table)
    p('App reference comparisons (history through selected end date)','Heading2')
    for b in report.get('baselines',[]):
        if b['baseline'] is not None: p(f"{b['hand']} / {b['type']}: reference {b['baseline']:.1f}; latest difference {b['delta']:+.1f}. {b['category']}. Reference dates: {', '.join(d[:10] for d in b['reference_dates'])}")
    p('Your notes','Heading2'); p(report['notes'] or 'None'); p('Questions for your clinician','Heading2'); p(report['questions'] or 'None')
    p('Limitations','Heading2'); p('This is not a diagnosis or certified medical report. Camera estimates depend on perspective, lighting and tracking quality. App references use three valid sessions and are not normal medical ranges. Summaries are deterministic, not clinical advice. No video is stored. Routine instructions are user-entered and are not verified.')
    SimpleDocTemplate(output,title='ArthriTrack appointment summary').build(story); return output.getvalue()
