/mattpocock-skills:code-review {{BASE_BRANCH}} — the spec is {{ISSUE_URL}}

You are running AFK in a sandbox, on branch `{{BRANCH}}`, reviewing work another session
committed for issue #{{ISSUE_NUMBER}}. Nobody will answer a question, so do not ask one:
the fixed point is `{{BASE_BRANCH}}`, and the spec is the issue above (read it with
`gh issue view {{ISSUE_NUMBER}} --comments`).

The issues-only token in this sandbox is a GitHub App installation token, minted once for the
whole run, and the implement session before you may have used most of its hour
(`.github/workflows/agent-implement.yml`, 170 minutes on the runner step). If
`gh issue view` fails with 401, do not retry it and do not look for another way in: review
what you can from `{{BASE_BRANCH}}`, the branch and the diff, and say in the review summary
which part of the spec you could not read, so a human merger knows what the review did not
cover. The summary is what the next session reads; it does not need the token.

Once both review axes have reported:

1. Fix every finding that is in the issue's scope, and commit the fixes to `{{BRANCH}}`,
   referencing `#{{ISSUE_NUMBER}}`. Don't redesign the change, and don't fix things the
   issue didn't ask for.
2. Don't push. The runner does that.
3. End with the review a human merger should read, inside tags:

<review-summary>
**Spec:** whether each acceptance criterion is met, one line each.
**Standards:** what you fixed, and anything left that a human should look at.
</review-summary>

Then output <promise>COMPLETE</promise>.
