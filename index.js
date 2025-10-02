const loading = true;
const cache = {
  set(key, data, ttl = 0.5 * 60 * 1000) {
    const record = {
      value: data,
      expiry: Date.now() + ttl,
    };
    localStorage.setItem(key, JSON.stringify(record));
  },

  get(key) {
    const item = localStorage.getItem(key);
    if (!item) return null;

    try {
      const record = JSON.parse(item);
      if (Date.now() > record.expiry) {
        localStorage.removeItem(key);
        return null;
      }
      return record.value;
    } catch {
      return null;
    }
  },
};

const path = window.location.pathname;
const storage = {
  set(key, value) {
    const finalValue =
      typeof value === "string" ? value : JSON.stringify(value);
    localStorage.setItem(key, finalValue);
  },
  get(key) {
    const stringValue = localStorage.getItem(key);
    try {
      const paresValue = JSON.parse(stringValue);
      return paresValue;
    } catch {
      return stringValue;
    }
  },
};
let message = "";
function http(url, config) {
  return new Promise((resolve, reject) => {
    fetch(url, config)
      .then((response) => {
        const { ok, status, headers } = response;
        const contentType = headers.get("content-type");
        const isJson = contentType.includes("application/json");
        if (isJson) {
          response
            .json()
            .then((data) => {
              if (ok) {
                resolve(data);
              } else {
                reject(new Error(data.error));
                // reject(new Error(status));
              }
            })
            .catch(() => {
              //     reject(new Error("خطای پردازش JSON"));
              reject(new Error(data.error));
            });
        } else {
          response
            .text()
            .then((text) => {
              if (ok) {
                resolve(text);
              } else {
                // reject(new Error(status));
                reject(new Error(text.error));
              }
            })
            .catch(() => {
              // reject(new Error("خطای پردازش متن"));
              reject(new Error(text.error));
            });
        }
      })
      .catch((error) => {
        //  reject(new Error("خطای شبکه"));
        reject(new Error(error.error));
      });
  });
}
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}

if (path.endsWith("login.html")) {
  if (getCookie("JWT") == "") {
    document.getElementById("loginForm").addEventListener("submit", (e) => {
      e.preventDefault();

      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;

      http(
        "https://karyar-library-management-system.liara.run/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        }
      )
        .then((response) => {
          const { token, data } = response;
          document.cookie = `JWT=${token}; path=/`;
          storage.set("firstName", response.user.firstName);
          storage.set("userId", response.user.id);

          window.location.href = "dashboard.html";
        })
        .catch((error) => {
          alert(error.message);
        });
    });
  } else {
    window.location.href = "index.html";
  }
}
function firstName() {
  const firstName = localStorage.getItem("firstName");
  document.querySelector(".user-info span").innerText = firstName;
}

if (path.endsWith("dashboard.html")) {
  if (getCookie("JWT") == null) {
    window.location.href = "login.html";
  } else {
    firstName();
    let activeLoans = 0;
    let availableBooks = 0;
    http("https://karyar-library-management-system.liara.run/api/auth/me", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${getCookie("JWT")}`,
      },
    })
      .then((response) => {
        const { data } = response;
        activeLoans = data.stats.activeLoans;

        availableBooks = data.stats.availableBooks;
        document.getElementById("activeLoans").innerText = activeLoans;
        document.getElementById("availableBooks").innerText = availableBooks;
        document
          .querySelector("#logout")
          .addEventListener("click", function () {
            localStorage.clear();
            document.cookie = `JWT=; path=/`;
          });
      })
      .catch((error) => {
        alert(error);
      });
  }
}
if (path.endsWith("books.html")) {
  if (getCookie("JWT") == null) {
    window.location.href = "login.html";
  } else {
    firstName();
    loadBooks();
  }
}
if (path.endsWith("my-loans.html")) {
  if (getCookie("JWT") == null) {
    window.location.href = "login.html";
  } else {
    firstName();
    loadMyLoans();
  }
}
if (path.endsWith("index.html")) {
  if (getCookie("JWT") == null) {
    window.location.href = "login.html";
  }
}
function loadBooks() {
  const cachedBooks = cache.get("books");
  if (cachedBooks) {
    renderBooks(cachedBooks);
    setInterval(() => {
      const books = cache.get("books");
      if (!books) {
        window.location.reload();
      }
    }, 5000);

    return;
  }
  http("https://karyar-library-management-system.liara.run/api/books", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${getCookie("JWT")}`,
    },
  })
    .then((response) => {
      const { data } = response;
      cache.set("books", data);
      renderBooks(data);
    })
    .catch((error) => {
      alert(error.message);
    });
}
function borrowBook(bookid) {
  const userId = storage.get("userId");
  const loanPeriod = 14;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + loanPeriod);

  http("https://karyar-library-management-system.liara.run/api/loans", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${getCookie("JWT")}`,
    },

    body: JSON.stringify({
      bookId: bookid,
      userId: userId,
      loanPeriod: loanPeriod,
      dueDate: dueDate.toISOString(),
    }),
  })
    .then((response) => {
      loadBooks();
    })
    .catch((error) => {
      alert(error);
    });
}

function loadMyLoans() {
  http(
    "https://karyar-library-management-system.liara.run/api/loans/my-loans",
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${getCookie("JWT")}`,
      },
    }
  )
    .then((response) => {
      const loans = response.data;
      let active = 0;
      let returns = 0;

      const cards = document.getElementById("cards");
      cards.innerHTML = "";
      loans.forEach((loan) => {
        const card = document.createElement("tr");
        card.classList.add("card");
        card.innerHTML = `
            <td>
              <strong>${loan.book.title}</strong>
              <br />
              <small style="color: #666">ISBN: ${loan.book.isbn}</small>
            </td>
            <td> ${loan.book.author}</td>
            <td> ${loan.loanDate}</td>
            <td>
              <span class="status status-active">${loan.status}</span>
            </td>
            <td>
              <button class="btn btn-success btn-sm return">Return</button>
            </td>
         `;
        cards.appendChild(card);
        const btnReturn = card.querySelector(".return");

        if (loan.status === "active") {
          active++;
        } else {
          returns++;
          btnReturn.classList.add("btn-secondary");
          btnReturn.classList.remove("btn-success");
          btnReturn.innerText = "Returned";
          btnReturn.disabled = true;
        }
        btnReturn.addEventListener("click", function () {
          returnBook(loan.id);
        });
      });
      document.getElementById("total-loans").innerText = response.data.length;
      document.getElementById("Active-Loans").innerText = active;
      document.getElementById("Returned-Books").innerText = returns;
      document.getElementById("logout").addEventListener("click", function () {
        localStorage.clear();
        document.cookie = `JWT=; path=/`;
      });
    })
    .catch((error) => {
      alert(error);
    });
}
function returnBook(loanId) {
  http(
    `https://karyar-library-management-system.liara.run/api/loans/${loanId}/return`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${getCookie("JWT")}`,
      },

      body: JSON.stringify({}),
    }
  )
    .then((response) => {
      loadMyLoans();
    })
    .catch((error) => {
      alert(error);
    });
}

function renderBooks(data) {
  const list = document.getElementById("list");
  list.innerHTML = "";

  data.forEach((book) => {
    const card = document.createElement("div");
    card.classList.add("card");

    card.innerHTML = `
    <div
      style="
        display: flex;
        justify-content: space-between;
        align-items: start;
        margin-bottom: 1rem;
      "
    >
      <h3 style="margin: 0; color: #2c3e50">${book.title}</h3>
      <span class="status status-available">${book.status}</span>
    </div>
    <p style="color: #666; margin-bottom: 0.5rem">
      <strong>Author:</strong> ${book.author || "Unknown"}
    </p>
    <p style="color: #666; margin-bottom: 0.5rem">
      <strong>ISBN:</strong> ${book.isbn || "N/A"}
    </p>
    <p style="color: #666; margin-bottom: 0.5rem">
      <strong>Category:</strong> ${book.category.name || "General"}
    </p>
    <p style="color: #666; margin-bottom: 1rem">
      <strong>Available Copies:</strong> ${book.availableCopies || 0}
    </p>
    <p style="margin-bottom: 1rem; font-size: 0.9rem; color: #555">
      ${book.description || ""}
    </p>
    <div style="display: flex; gap: 0.5rem">
      <button class="btn btn-primary btn-sm brrow">Borrow Book</button>
      <button class="btn btn-secondary btn-sm">View Details</button>
    </div>
  `;

    list.appendChild(card);
    const borrowBtn = card.querySelector(".brrow");
    const status = card.querySelector(".status");
    if (book.availableCopies === 0) {
      borrowBtn.disabled = true;
      borrowBtn.innerText = "Not Available";
      borrowBtn.disabled = true;
      status.classList.remove("status-available");
      status.classList.add("status-unavailable");
    }
    borrowBtn.addEventListener("click", () => {
      borrowBook(book.id);
    });
  });
  document.getElementById("logout").addEventListener("click", function () {
    localStorage.clear();
    document.cookie = `JWT=; path=/`;
  });
}
