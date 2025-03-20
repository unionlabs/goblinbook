// Populate the sidebar
//
// This is a script, and not included directly in the page, to control the total size of the book.
// The TOC contains an entry for each page, so if each page includes a copy of the TOC,
// the total size of the page becomes O(n**2).
class MDBookSidebarScrollbox extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        this.innerHTML = '<ol class="chapter"><li class="chapter-item expanded affix "><a href="cover.html">Cover</a></li><li class="chapter-item expanded affix "><a href="foreword.html">Foreword</a></li><li class="chapter-item expanded affix "><a href="introduction.html">Introduction</a></li><li class="chapter-item expanded "><a href="getting-started/getting-started.html"><strong aria-hidden="true">1.</strong> Getting Started</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="getting-started/nix.html"><strong aria-hidden="true">1.1.</strong> Nix</a></li><li class="chapter-item expanded "><a href="getting-started/apple/apple.html"><strong aria-hidden="true">1.2.</strong> Apple</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="getting-started/apple/orbstack.html"><strong aria-hidden="true">1.2.1.</strong> Orbstack</a></li></ol></li></ol></li><li class="chapter-item expanded "><a href="dispatching-asset-transfer.html"><strong aria-hidden="true">2.</strong> Dispatching an Asset Transfer</a></li><li class="chapter-item expanded "><a href="union/overview.html"><strong aria-hidden="true">3.</strong> Union</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="union/connections.html"><strong aria-hidden="true">3.1.</strong> Connections</a></li><li class="chapter-item expanded "><a href="union/channels.html"><strong aria-hidden="true">3.2.</strong> Channels</a></li><li class="chapter-item expanded "><a href="union/packets.html"><strong aria-hidden="true">3.3.</strong> Packets</a></li><li class="chapter-item expanded "><a href="union/clients.html"><strong aria-hidden="true">3.4.</strong> Clients</a></li><li class="chapter-item expanded "><a href="union/open-filling.html"><strong aria-hidden="true">3.5.</strong> Open Filling</a></li><li class="chapter-item expanded "><a href="union/relayer.html"><strong aria-hidden="true">3.6.</strong> Relayer</a></li><li class="chapter-item expanded "><a href="union/addresses.html"><strong aria-hidden="true">3.7.</strong> Addresses</a></li><li class="chapter-item expanded "><a href="union/chain-ids.html"><strong aria-hidden="true">3.8.</strong> Chain IDs</a></li></ol></li><li class="chapter-item expanded "><a href="dex/overview.html"><strong aria-hidden="true">4.</strong> project: Nexus</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="dex/architecture.html"><strong aria-hidden="true">4.1.</strong> Architecture</a></li><li class="chapter-item expanded "><a href="dex/swaps.html"><strong aria-hidden="true">4.2.</strong> Swaps</a></li><li class="chapter-item expanded "><a href="dex/sdk.html"><strong aria-hidden="true">4.3.</strong> SDK</a></li></ol></li><li class="chapter-item expanded "><a href="resources.html"><strong aria-hidden="true">5.</strong> Resources</a></li></ol>';
        // Set the current, active page, and reveal it if it's hidden
        let current_page = document.location.href.toString().split("#")[0];
        if (current_page.endsWith("/")) {
            current_page += "index.html";
        }
        var links = Array.prototype.slice.call(this.querySelectorAll("a"));
        var l = links.length;
        for (var i = 0; i < l; ++i) {
            var link = links[i];
            var href = link.getAttribute("href");
            if (href && !href.startsWith("#") && !/^(?:[a-z+]+:)?\/\//.test(href)) {
                link.href = path_to_root + href;
            }
            // The "index" page is supposed to alias the first chapter in the book.
            if (link.href === current_page || (i === 0 && path_to_root === "" && current_page.endsWith("/index.html"))) {
                link.classList.add("active");
                var parent = link.parentElement;
                if (parent && parent.classList.contains("chapter-item")) {
                    parent.classList.add("expanded");
                }
                while (parent) {
                    if (parent.tagName === "LI" && parent.previousElementSibling) {
                        if (parent.previousElementSibling.classList.contains("chapter-item")) {
                            parent.previousElementSibling.classList.add("expanded");
                        }
                    }
                    parent = parent.parentElement;
                }
            }
        }
        // Track and set sidebar scroll position
        this.addEventListener('click', function(e) {
            if (e.target.tagName === 'A') {
                sessionStorage.setItem('sidebar-scroll', this.scrollTop);
            }
        }, { passive: true });
        var sidebarScrollTop = sessionStorage.getItem('sidebar-scroll');
        sessionStorage.removeItem('sidebar-scroll');
        if (sidebarScrollTop) {
            // preserve sidebar scroll position when navigating via links within sidebar
            this.scrollTop = sidebarScrollTop;
        } else {
            // scroll sidebar to current active section when navigating via "next/previous chapter" buttons
            var activeSection = document.querySelector('#sidebar .active');
            if (activeSection) {
                activeSection.scrollIntoView({ block: 'center' });
            }
        }
        // Toggle buttons
        var sidebarAnchorToggles = document.querySelectorAll('#sidebar a.toggle');
        function toggleSection(ev) {
            ev.currentTarget.parentElement.classList.toggle('expanded');
        }
        Array.from(sidebarAnchorToggles).forEach(function (el) {
            el.addEventListener('click', toggleSection);
        });
    }
}
window.customElements.define("mdbook-sidebar-scrollbox", MDBookSidebarScrollbox);
