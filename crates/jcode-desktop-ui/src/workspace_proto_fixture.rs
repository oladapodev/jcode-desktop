//! Offline screenshot fixture: the sessions, projects and agents of the web
//! prototype's demo data (`JCODE_DESKTOP_SCREENSHOT_DEMO_DATA=prototype`).
use super::*;

impl Workspace {
    pub(super) fn init_prototype_fixture(&mut self, cx: &mut Context<Self>) {
        if !crate::panel::proto_fixture::enabled() {
            return;
        }
        let Some(template) = self.sessions.first().cloned() else {
            return;
        };
        let now = unix_now_ms();
        let minute = 60_000;
        // (id, title, project, status, age in minutes, agents, edits)
        let rows: [(&str, &str, &str, &str, i64, usize, Option<(u64, u64)>); 5] = [
            ("screenshot-fixture", "Realistic Korope render", "tasued", "working", 0, 6, Some((9648, 2163))),
            ("proto-catalog", "Catalog provenance tests", "tasued", "waiting", 12, 0, None),
            ("proto-harness", "Personal harness plan", "jcode", "idle", 34, 0, None),
            ("proto-ship", "Ship the booking flow", "grace", "waiting", 60, 4, Some((7031, 3361))),
            ("proto-demos", "Demo reel scenes", "hostel", "idle", 10_080, 0, None),
        ];
        self.sessions.clear();
        for (id, title, project, status, age, agents, edits) in rows {
            let mut session = template.clone();
            session.session_id = id.into();
            session.title = Some(title.into());
            session.working_dir = Some(format!("/home/dev/Desktop/{project}"));
            session.status = status.into();
            // Shown as project rows rather than under past sessions.
            session.user_connected = true;
            session.updated_at_ms = Some(now - age * minute);
            session.last_active_at_ms = session.updated_at_ms;
            session.edit_stats = edits.map(|(added, removed)| jcode_sdk::SessionEditStats {
                added,
                removed,
                approximate: false,
            });
            self.sessions.push(session.clone());
            for index in 0..agents {
                let mut child = session.clone();
                child.session_id = format!("{id}-agent-{index}");
                child.parent_session_id = Some(id.into());
                child.agent_label = Some(format!("Agent {}", index + 1));
                child.swarm_status = Some(if index % 3 == 2 { "completed" } else { "working" }.into());
                child.edit_stats = None;
                self.sessions.push(child);
            }
        }
        // Projects are expanded except hostel, as in the prototype.
        for project in ["tasued", "jcode", "grace"] {
            self.sidebar_projects
                .collapsed
                .insert(format!("/home/dev/Desktop/{project}"), false);
        }
        self.sidebar_projects
            .collapsed
            .insert("/home/dev/Desktop/hostel".into(), true);
        let title = "Realistic Korope render";
        let dir = "/home/dev/Desktop/tasued";
        for slot in &self.slots {
            slot.panel.update(cx, |panel, _| {
                panel.title = title.into();
                panel.working_dir = Some(dir.into());
            });
        }
    }
}
