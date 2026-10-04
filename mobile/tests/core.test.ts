import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HttpClient, ApiError } from '../src/api/http';
import { consultationActions, elapsedSeconds, formatDuration } from '../src/utils/consultation';
import { availableSlots } from '../src/utils/availability';
import { passwordRequirements } from '../src/utils/password';
import type { ConsultationResponse, DentistAvailability } from '../src/types';

test('fetch is invoked without binding the HTTP client as its receiver', async () => {
  const client = new HttpClient('https://api.example.test',async () => null,async function(this: unknown) {
    assert.equal(this,undefined);
    return Response.json({ok:true});
  });
  assert.deepEqual(await client.get('/health'),{ok:true});
});

test('unauthorized requests refresh Firebase token once and retain the API payload', async () => {
  const requests: RequestInit[] = []; const refreshes: boolean[] = [];
  const client = new HttpClient('https://api.example.test/', async (refresh) => { refreshes.push(!!refresh); return refresh ? 'fresh-token' : 'old-token'; }, async (input, options) => {
    assert.equal(input, 'https://api.example.test/api/consultations/1/start'); requests.push(options!);
    return requests.length === 1 ? new Response('{}', { status:401 }) : Response.json({session_status:'active'});
  });
  assert.deepEqual(await client.patch('/api/consultations/1/start',{}),{session_status:'active'});
  assert.deepEqual(refreshes,[false,true]); assert.equal(requests[1].body,'{}');
  assert.equal((requests[1].headers as Record<string,string>).Authorization,'Bearer fresh-token');
});
test('second unauthorized response stops retrying and exposes server errors', async () => {
  let calls = 0; const client = new HttpClient('https://api.example.test',async () => 'token',async () => { calls++; return Response.json({detail:'Account disabled'},{status:401}); });
  await assert.rejects(client.get('/me'),(error: unknown) => error instanceof ApiError && error.status === 401 && error.message === 'Account disabled'); assert.equal(calls,2);
});
test('multipart upload lets the native transport set its boundary', async () => {
  const body = new FormData(); body.append('file',new Blob(['fake image'],{type:'image/jpeg'}),'oral.jpg');
  const client = new HttpClient('https://api.example.test',async () => 'token',async (_,options) => { assert.equal(options?.body,body); assert.equal((options?.headers as Record<string,string>)['Content-Type'],undefined); return Response.json({id:'image'}); });
  assert.deepEqual(await client.post('/upload',body),{id:'image'});
});
test('validation details and request cancellation remain actionable', async () => {
  const client = new HttpClient('https://api.example.test',async () => null,async () => Response.json({detail:[{msg:'Choose a valid date'}]},{status:422}));
  await assert.rejects(client.get('/appointments'),/Choose a valid date/);
  const signal = new AbortController(); signal.abort();
  const cancelled = new HttpClient('https://api.example.test',async () => null,async (_,options) => { assert.equal(options?.signal?.aborted,true); throw new Error('aborted'); });
  await assert.rejects(cancelled.get('/me',signal.signal),/interrupted/);
});
test('consultation controls enforce role, verification and terminal states', () => {
  assert.equal(consultationActions('patient','active').end,false);
  assert.equal(consultationActions('patient','scheduled').cancel,true);
  assert.equal(consultationActions('dentist','scheduled',false).start,false);
  assert.equal(consultationActions('dentist','scheduled',true).start,true);
  for (const state of ['ended','failed']) assert.deepEqual(consultationActions('dentist',state,true),{start:false,end:false,cancel:false});
});
test('consultation timer resumes from the authoritative start and freezes at recorded duration', () => {
  const started = {session_status:'active',started_at:'2026-10-03T10:00:00Z'} as ConsultationResponse;
  assert.equal(elapsedSeconds(started,Date.parse('2026-10-03T10:02:05Z')),125);
  assert.equal(formatDuration(125),'02:05');
  assert.equal(elapsedSeconds({...started,session_status:'ended',duration_seconds:98},Date.now()),98);
});
test('availability uses backend Sunday=0 mapping, rejects invalid dates and never exceeds a window', () => {
  const windows = [{day_of_week:0,start_time:'09:00:00',end_time:'10:10:00',slot_duration_minutes:30,is_active:true}] as DentistAvailability[];
  const slots = availableSlots(windows,'2026-10-04',Date.parse('2026-10-04T09:05:00Z'));
  assert.deepEqual(slots,[{start:'2026-10-04T09:30:00.000Z',end:'2026-10-04T10:00:00.000Z'}]);
  assert.deepEqual(availableSlots(windows,'2026-02-30'),[]);
  assert.deepEqual(availableSlots(windows,'2026-10-05',0),[]);
  assert.deepEqual(availableSlots([{...windows[0],slot_duration_minutes:0}],'2026-10-04',0),[]);
});
test('registration follows main password requirements', () => {
  assert.equal(passwordRequirements('abcdefgh').every((r) => r.met),false);
  assert.equal(passwordRequirements('ClearSmile8!').every((r) => r.met),true);
});
