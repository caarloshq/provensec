# Availability and incident evidence (guided check)

This guide checks whether an application can detect and communicate an outage. It
does not run a monitor. Apply each check to the deployed environment being
reviewed; mark an absent dependency **not applicable** with the reason. Code,
configuration and a successful health response are evidence of implementation,
not evidence that a periodic check or notification works.

Before any failure test, obtain the owner's permission and use staging or another
controlled environment. Do not submit real customer transactions or expose
credentials, request bodies, personal data, stack traces or full logs in the report.

| Check | Failing case to run | Evidence for a pass |
|---|---|---|
| Application and required dependencies | Check the health endpoint while the app is healthy; then make one required dependency unavailable in a controlled test and check again. The endpoint should use a bounded timeout, return non-2xx for the failed dependency and reveal no sensitive details. A static `200 OK` is a failure. If no endpoint is appropriate, document the equivalent probe and its failure behavior. | Timestamped status codes and the dependency checked, without secrets. Name dependencies excluded on purpose. |
| External availability | Observe the configured periodic check from a system outside the application's host. During a controlled outage, confirm it records a failure; after recovery, confirm it records recovery. A local process cannot establish that the host itself is reachable. | Monitor location, target, interval, failure threshold, last check, failure and recovery timestamps. Configuration alone is **not verified**. |
| Safe errors and useful logs | Trigger a controlled application error and a denied access. Inspect the user response under **A27** and the stored events under **A32**. Check that the response gives a useful next step, the logs identify the event and time, and neither contains secrets or unnecessary personal data. Confirm where logs live and their retention. | Redacted sample response and event fields, retention setting and a retrieval of the test events. Do not paste raw logs. |
| Delivered alert | Trigger the monitor's failure condition in a controlled test and ask the intended recipient to confirm receipt on their phone; then verify recovery handling. A sent event, API success or configured channel does not prove receipt. | Recipient role, channel, failure timestamp, receipt confirmation and recovery result, with message contents redacted. |

Report every applicable check as **passed**, **failed** or **not verified** with
the missing test or evidence. Use **not applicable** only with the deployment
reason. Keep A27 and A32 as the owners of error exposure and logging findings;
this guide connects their evidence to availability. Never report an active
monitor solely because the endpoint or configuration exists.
