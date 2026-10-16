//! Offline screenshot fixture: the sessions, projects and agents of the web
//! prototype's demo data (`JCODE_DESKTOP_SCREENSHOT_DEMO_DATA=prototype`).
use super::*;

impl Workspace {
    pub(super) fn init_prototype_fixture(&mut self, cx: &mut Context<Self>) {
        self.init_stress_fixture(cx);
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

    /// `--demo-data stress`: the catalog shapes a real server with 100+
    /// sessions produces, for robustness screenshots.
    fn init_stress_fixture(&mut self, cx: &mut Context<Self>) {
        if !crate::panel::proto_fixture::stress() {
            return;
        }
        let Some(template) = self.sessions.first().cloned() else {
            return;
        };
        let now = unix_now_ms();
        let long_title = "Investigate why the reconnect logic drops queued prompts when the laptop sleeps for longer than the server keepalive interval and then resumes on a different network";
        let long_dir = format!(
            "/home/dev/Desktop/{}",
            "an-extremely-long-project-directory-name-that-never-ends".repeat(2)
        );
        let mut lead = template.clone();
        lead.title = Some(long_title.into());
        lead.working_dir = Some(long_dir.clone());
        lead.status = "working".into();
        lead.user_connected = true;
        lead.updated_at_ms = Some(now);
        self.sessions = vec![lead.clone()];
        // A swarm far bigger than the map's visible row.
        for index in 0..24 {
            let mut child = lead.clone();
            child.session_id = match index % 4 {
                1 => format!("ssh://a-very-long-cloud-machine-hostname.internal.example.com/stress-agent-{index}"),
                2 => format!("ssh://gcp-home/stress-agent-{index}"),
                _ => format!("stress-agent-{index}"),
            };
            child.parent_session_id = Some(lead.session_id.clone());
            child.agent_label = (index % 5 != 4).then(|| {
                if index % 3 == 0 {
                    format!("Agent {index} with a long descriptive label for its sub task")
                } else {
                    format!("Agent {index}")
                }
            });
            child.title = (index % 5 != 4).then(|| format!("Sub task {index}: {}", "long title ".repeat(8)));
            child.swarm_status = Some(
                ["working", "waiting", "failed", "completed", "queued"][index % 5].into(),
            );
            self.sessions.push(child);
        }
        // 60 sessions in one project, some untitled, some with a long subdirectory.
        for index in 0..60 {
            let mut session = template.clone();
            session.session_id = format!("stress-session-{index}");
            session.title = match index % 6 {
                0 => None,
                1 => Some(String::new()),
                2 => Some(format!("{long_title} {index}")),
                3 => Some("averyveryverylongunbrokentitlewithoutanyspaces".repeat(4)),
                _ => Some(format!("Session {index}")),
            };
            session.working_dir = Some(if index % 9 == 4 {
                format!("{long_dir}/crates/some-deeply/nested/sub-directory/{index}")
            } else {
                long_dir.clone()
            });
            session.status = ["idle", "working", "waiting", "failed", "idle"][index % 5].into();
            session.user_connected = index < 8;
            session.updated_at_ms = Some(now - index as i64 * 3_600_000);
            session.edit_stats = (index % 4 == 0).then_some(jcode_sdk::SessionEditStats {
                added: 123_456,
                removed: 98_765,
                approximate: index % 8 == 0,
            });
            self.sessions.push(session);
        }
        // Remote and directory-less sessions.
        for (index, id) in [
            "ssh://a-very-long-cloud-machine-hostname.internal.example.com/remote-one",
            "ssh://jcode-cloud-alpha/remote-two",
            "no-directory-session",
        ]
        .into_iter()
        .enumerate()
        {
            let mut session = template.clone();
            session.session_id = id.into();
            session.title = Some(format!("Remote work {index} {}", "on a cloud box ".repeat(5)));
            session.working_dir = (index < 2).then(|| long_dir.clone());
            session.user_connected = true;
            session.updated_at_ms = Some(now - index as i64 * 60_000);
            self.sessions.push(session);
        }
        self.sidebar_projects.collapsed.insert(long_dir.clone(), false);
        for slot in &self.slots {
            slot.panel.update(cx, |panel, _| {
                panel.title = long_title.into();
                panel.working_dir = Some(long_dir.clone());
                panel.model = None;
                panel.provider = None;
            });
        }
    }
}
